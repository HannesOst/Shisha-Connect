import { supabase } from './supabase';
import type {
  AppNotification,
  BarCandidate,
  Bar,
  Group,
  GroupMember,
  Meetup,
  Profile,
  RsvpStatus,
} from './types';

const MEETUP_SELECT = `
  id, group_id, created_by, message, status, starts_at, created_at, updated_at,
  bar:bars!meetups_bar_id_fkey(*),
  group:groups!meetups_group_id_fkey(id, name),
  creator:profiles!meetups_created_by_fkey(id, display_name, avatar_url),
  rsvps(user_id, status, updated_at)
`;

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Nicht angemeldet');
  return id;
}

// --- Profile ---------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const id = await myId();
  unwrap(await supabase.from('profiles').update(patch).eq('id', id));
}

function base64ToBytes(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, index);
}

/** Uploads a picked image (base64) and stores its public URL in the profile. */
export async function uploadAvatar(base64: string, mimeType = 'image/jpeg'): Promise<string> {
  const id = await myId();
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `${id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, base64ToBytes(base64), { contentType: mimeType, upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await updateProfile({ avatar_url: data.publicUrl });
  return data.publicUrl;
}

// --- Groups ----------------------------------------------------------------

export async function fetchMyGroups(): Promise<Group[]> {
  const id = await myId();
  const rows = unwrap(
    await supabase.from('group_members').select('group:groups(*)').eq('user_id', id).order('joined_at'),
  ) as unknown as { group: Group | null }[];
  return rows.map((r) => r.group).filter((g): g is Group => !!g);
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  return unwrap(
    await supabase
      .from('group_members')
      .select('role, joined_at, profile:profiles(id, display_name, avatar_url)')
      .eq('group_id', groupId)
      .order('joined_at'),
  ) as unknown as GroupMember[];
}

export async function createGroup(name: string): Promise<Group> {
  return unwrap(await supabase.rpc('create_group', { p_name: name })) as Group;
}

export async function joinGroup(code: string): Promise<Group> {
  return unwrap(await supabase.rpc('join_group', { p_code: code })) as Group;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const id = await myId();
  unwrap(await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', id));
}

export async function regenerateInviteCode(groupId: string): Promise<string> {
  return unwrap(await supabase.rpc('regenerate_invite_code', { p_group_id: groupId })) as string;
}

// --- Bars --------------------------------------------------------------------

export async function fetchGroupBars(): Promise<Bar[]> {
  // RLS only returns bars of the user's own groups.
  return unwrap(await supabase.from('bars').select('*').eq('source', 'manual').order('name')) as Bar[];
}

export async function addManualBar(
  groupId: string,
  bar: { name: string; address: string | null; lat: number | null; lng: number | null; opening_hours: string | null },
): Promise<Bar> {
  const id = await myId();
  return unwrap(
    await supabase
      .from('bars')
      .insert({ ...bar, group_id: groupId, source: 'manual', created_by: id })
      .select('*')
      .single(),
  ) as Bar;
}

export async function fetchFavorites(): Promise<BarCandidate[]> {
  const rows = unwrap(await supabase.from('favorites').select('bar_key, bar').order('created_at')) as {
    bar_key: string;
    bar: BarCandidate;
  }[];
  return rows.map((r) => ({ ...r.bar, key: r.bar_key }));
}

export async function addFavorite(bar: BarCandidate): Promise<void> {
  const id = await myId();
  const { distanceKm: _distance, ...snapshot } = bar;
  unwrap(await supabase.from('favorites').upsert({ user_id: id, bar_key: bar.key, bar: snapshot }));
}

export async function removeFavorite(key: string): Promise<void> {
  const id = await myId();
  unwrap(await supabase.from('favorites').delete().eq('user_id', id).eq('bar_key', key));
}

function barPayload(bar: BarCandidate) {
  return {
    id: bar.id ?? null,
    external_id: bar.external_id ?? null,
    name: bar.name,
    address: bar.address ?? null,
    lat: bar.lat ?? null,
    lng: bar.lng ?? null,
    opening_hours: bar.opening_hours ?? null,
    website: bar.website ?? null,
    phone: bar.phone ?? null,
    source: bar.source,
  };
}

// --- Meetups -----------------------------------------------------------------

export async function fetchUpcomingMeetups(): Promise<Meetup[]> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const rows = unwrap(
    await supabase
      .from('meetups')
      .select(MEETUP_SELECT)
      .or(`starts_at.gte."${since}",starts_at.is.null`)
      .order('starts_at', { ascending: true, nullsFirst: true })
      .limit(50),
  ) as unknown as Meetup[];
  // Voting meetups without a time: hide stale ones after a week.
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return rows.filter((m) => m.starts_at || new Date(m.created_at).getTime() > weekAgo);
}

export async function fetchMeetup(id: string): Promise<Meetup | null> {
  const { data, error } = await supabase
    .from('meetups')
    .select(`${MEETUP_SELECT}, options:meetup_options(id, starts_at, bar:bars!meetup_options_bar_id_fkey(*), votes:option_votes(user_id))`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const meetup = data as unknown as Meetup;
  meetup.options?.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || (a.bar?.name ?? '').localeCompare(b.bar?.name ?? ''));
  return meetup;
}

export type NotifyEvent = 'created' | 'updated' | 'confirmed' | 'cancelled';
export type NotifyResult = { recipients: number; pushed: number } | { error: string };

/** Triggers the push notifications (edge function). Never throws – the meetup itself is already saved. */
export async function notifyGroup(meetupId: string, event: NotifyEvent): Promise<NotifyResult> {
  const { data, error } = await supabase.functions.invoke('notify', { body: { meetupId, event } });
  if (error) {
    console.warn('notify failed', error);
    return { error: error.message };
  }
  return data as NotifyResult;
}

export async function createMeetup(input: {
  groupId: string;
  message: string;
  bars: BarCandidate[];
  times: Date[];
}): Promise<{ id: string; notify: NotifyResult }> {
  const id = unwrap(
    await supabase.rpc('create_meetup', {
      p_group_id: input.groupId,
      p_message: input.message,
      p_bars: input.bars.map(barPayload),
      p_times: input.times.map((t) => t.toISOString()),
    }),
  ) as string;
  const notify = await notifyGroup(id, 'created');
  return { id, notify };
}

export async function updateMeetup(input: {
  meetupId: string;
  bar: BarCandidate | null;
  startsAt: Date;
  message: string;
}): Promise<NotifyResult> {
  unwrap(
    await supabase.rpc('update_meetup', {
      p_meetup_id: input.meetupId,
      p_bar: input.bar ? barPayload(input.bar) : null,
      p_starts_at: input.startsAt.toISOString(),
      p_message: input.message,
    }),
  );
  return notifyGroup(input.meetupId, 'updated');
}

export async function confirmOption(meetupId: string, optionId: string): Promise<NotifyResult> {
  unwrap(await supabase.rpc('confirm_option', { p_meetup_id: meetupId, p_option_id: optionId }));
  return notifyGroup(meetupId, 'confirmed');
}

export async function cancelMeetup(meetupId: string): Promise<NotifyResult> {
  unwrap(await supabase.from('meetups').update({ status: 'cancelled' }).eq('id', meetupId));
  return notifyGroup(meetupId, 'cancelled');
}

export async function setRsvp(meetupId: string, status: RsvpStatus): Promise<void> {
  const id = await myId();
  unwrap(
    await supabase
      .from('rsvps')
      .upsert({ meetup_id: meetupId, user_id: id, status, updated_at: new Date().toISOString() }),
  );
}

export async function setVote(meetupId: string, optionId: string, voted: boolean): Promise<void> {
  const id = await myId();
  if (voted) {
    unwrap(
      await supabase
        .from('option_votes')
        .upsert({ option_id: optionId, meetup_id: meetupId, user_id: id }, { ignoreDuplicates: true }),
    );
  } else {
    unwrap(await supabase.from('option_votes').delete().eq('option_id', optionId).eq('user_id', id));
  }
}

// --- Notifications inbox -----------------------------------------------------

export async function fetchNotifications(): Promise<AppNotification[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('id, meetup_id, type, title, body, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ) as AppNotification[];
}

export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationsRead(meetupId?: string): Promise<void> {
  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (meetupId) query = query.eq('meetup_id', meetupId);
  await query;
}

/** Sends a push notification to the user's own devices to verify the setup. Returns the number of delivered tickets. */
export async function sendTestPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('notify', { body: { test: true } });
  if (error) throw new Error(error.message);
  return (data as { pushed: number }).pushed;
}
