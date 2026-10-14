// Runs every 5 minutes (pg_cron, see supabase/cron.sql) and reminds everyone who answered
// "Dabei" or "Vielleicht" about one hour before the meetup starts.
import { adminClient, formatTime, json, sendPush, type PushMessage } from '../_shared/push.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) return json({ error: 'Unauthorized' }, 401);

  const admin = adminClient();
  const { data: due, error } = await admin.rpc('claim_due_reminders');
  if (error) return json({ error: error.message }, 500);

  const rows = (due ?? []) as { user_id: string; meetup_id: string; starts_at: string; bar_name: string | null }[];
  if (rows.length === 0) return json({ reminders: 0, pushed: 0 });

  const notifications = rows.map((row) => ({
    user_id: row.user_id,
    meetup_id: row.meetup_id,
    type: 'reminder',
    title: 'Gleich geht’s los',
    body: `Um ${formatTime(row.starts_at)} Uhr in der ${row.bar_name ?? 'Bar'}. Bis gleich!`,
  }));
  const { error: insertError } = await admin.from('notifications').insert(notifications);
  if (insertError) console.error('Inbox insert failed', insertError);

  const messages: PushMessage[] = notifications.map((n) => ({
    userId: n.user_id,
    title: n.title,
    body: n.body,
    meetupId: n.meetup_id,
  }));
  const pushed = await sendPush(admin, messages);
  return json({ reminders: rows.length, pushed });
});
