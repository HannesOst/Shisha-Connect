// Called by the app right after the creator published, changed, decided or cancelled a meetup.
// Writes an entry into every recipient's in-app inbox and sends a real push notification
// to all of their devices (if notifications are enabled).
import { adminClient, formatWhen, json, sendPush, type PushMessage } from '../_shared/push.ts';

type NotifyEvent = 'created' | 'updated' | 'confirmed' | 'cancelled';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = adminClient();
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Nicht angemeldet' }, 401);
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: 'Nicht angemeldet' }, 401);

  const { meetupId, event, test } = (await req.json()) as { meetupId?: string; event?: NotifyEvent; test?: boolean };

  // "Test-Push an mich senden" in the profile: verifies the whole push chain for the caller's devices.
  if (test) {
    const title = 'Shisha Connect';
    const body = 'Test erfolgreich – Push-Nachrichten kommen an. 🔥';
    await admin.from('notifications').insert({ user_id: auth.user.id, type: 'test', title, body });
    const pushed = await sendPush(admin, [{ userId: auth.user.id, title, body, meetupId: null }]);
    return json({ recipients: 1, pushed });
  }

  if (!meetupId || !event || !['created', 'updated', 'confirmed', 'cancelled'].includes(event)) {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  const { data: meetup, error } = await admin
    .from('meetups')
    .select(
      'id, group_id, created_by, status, starts_at, message, bar:bars!meetups_bar_id_fkey(name), creator:profiles!meetups_created_by_fkey(display_name), group:groups!meetups_group_id_fkey(name)',
    )
    .eq('id', meetupId)
    .single();
  if (error || !meetup) return json({ error: 'Treffen nicht gefunden' }, 404);
  if (meetup.created_by !== auth.user.id) {
    return json({ error: 'Nur der Ersteller kann benachrichtigen' }, 403);
  }
  const expectedStatus: Record<NotifyEvent, string[]> = {
    created: ['confirmed', 'voting'],
    updated: ['confirmed'],
    confirmed: ['confirmed'],
    cancelled: ['cancelled'],
  };
  if (!expectedStatus[event].includes(meetup.status)) {
    return json({ error: 'Status passt nicht zum Ereignis' }, 409);
  }

  // deno-lint-ignore no-explicit-any
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const creatorName: string = one(meetup.creator)?.display_name ?? 'Jemand';
  const barName: string = one(meetup.bar)?.name ?? 'der Bar';
  const groupName: string = one(meetup.group)?.name ?? 'Shisha Connect';

  const { data: members } = await admin
    .from('group_members')
    .select('user_id')
    .eq('group_id', meetup.group_id)
    .neq('user_id', meetup.created_by);
  let recipients = (members ?? []).map((m) => m.user_id as string);

  // Changes and cancellations are not sent to people who already said "Keine Zeit".
  if (event === 'updated' || event === 'cancelled') {
    const { data: declined } = await admin
      .from('rsvps')
      .select('user_id')
      .eq('meetup_id', meetupId)
      .eq('status', 'no');
    const declinedIds = new Set((declined ?? []).map((r) => r.user_id));
    recipients = recipients.filter((id) => !declinedIds.has(id));
  }

  let title = groupName;
  let body: string;
  if (event === 'created' && meetup.status === 'voting') {
    const { count } = await admin
      .from('meetup_options')
      .select('id', { count: 'exact', head: true })
      .eq('meetup_id', meetupId);
    title = `Abstimmung in ${groupName}`;
    body = `${creatorName} fragt: Wann und wo? ${count ?? 'Mehrere'} Vorschläge – stimm jetzt ab!`;
  } else if (event === 'created') {
    body = `${creatorName} lädt ein: ${formatWhen(meetup.starts_at!)} in der ${barName}. Bist du dabei?`;
  } else if (event === 'confirmed') {
    title = `Entschieden in ${groupName}`;
    body = `${formatWhen(meetup.starts_at!)} in der ${barName}. Bist du dabei?`;
  } else if (event === 'updated') {
    title = `Änderung in ${groupName}`;
    body = `${creatorName} hat das Treffen geändert: ${formatWhen(meetup.starts_at!)} in der ${barName}.`;
  } else {
    title = `Abgesagt in ${groupName}`;
    body = meetup.starts_at
      ? `${creatorName} hat das Treffen ${formatWhen(meetup.starts_at, true)} in der ${barName} abgesagt.`
      : `${creatorName} hat die Abstimmung abgesagt.`;
  }
  if (event === 'created' && meetup.message) {
    body = `${body}\n„${meetup.message}“`;
  }

  if (recipients.length > 0) {
    const { error: insertError } = await admin.from('notifications').insert(
      recipients.map((userId) => ({ user_id: userId, meetup_id: meetupId, type: event, title, body })),
    );
    if (insertError) console.error('Inbox insert failed', insertError);
  }

  const messages: PushMessage[] = recipients.map((userId) => ({ userId, title, body, meetupId }));
  const pushed = await sendPush(admin, messages);
  return json({ recipients: recipients.length, pushed });
});
