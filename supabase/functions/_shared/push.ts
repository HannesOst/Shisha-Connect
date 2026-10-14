// Shared helpers for the edge functions: Supabase admin client, German date texts
// and delivery through the Expo Push Service (which forwards to APNs / FCM).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const TIMEZONE = Deno.env.get('APP_TIMEZONE') ?? 'Europe/Zurich';

export function adminClient(): SupabaseClient {
  // SUPABASE_SERVICE_ROLE_KEY is provided automatically; SERVICE_ROLE_KEY can be set manually as a fallback.
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
  return createClient(Deno.env.get('SUPABASE_URL')!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "Heute um 20:00 Uhr", "Morgen um 21:30 Uhr", "am Fr., 17.10. um 20:00 Uhr" (lower case inside a sentence) */
export function formatWhen(iso: string, midSentence = false): string {
  const text = formatWhenCapitalized(iso);
  return midSentence ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function formatWhenCapitalized(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const time = `${formatTime(iso)} Uhr`;
  if (dayKey(date) === dayKey(now)) return `Heute um ${time}`;
  if (dayKey(date) === dayKey(tomorrow)) return `Morgen um ${time}`;
  const day = new Intl.DateTimeFormat('de-CH', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
  return `am ${day} um ${time}`;
}

export type PushMessage = {
  userId: string;
  title: string;
  body: string;
  meetupId: string | null;
};

const EXPO_PUSH_URL = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';

/**
 * Sends push notifications to all devices of the given users that have notifications enabled.
 * Tokens Expo reports as no longer registered are removed.
 */
export async function sendPush(admin: SupabaseClient, messages: PushMessage[]): Promise<number> {
  const userIds = [...new Set(messages.map((m) => m.userId))];
  if (userIds.length === 0) return 0;

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, notifications_enabled')
    .in('id', userIds);
  if (profileError) throw profileError;
  const enabled = new Set((profiles ?? []).filter((p) => p.notifications_enabled).map((p) => p.id));

  const { data: tokens, error: tokenError } = await admin
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', [...enabled]);
  if (tokenError) throw tokenError;

  const outgoing: { token: string; payload: Record<string, unknown> }[] = [];
  for (const message of messages) {
    if (!enabled.has(message.userId)) continue;
    for (const t of tokens ?? []) {
      if (t.user_id !== message.userId) continue;
      outgoing.push({
        token: t.token,
        payload: {
          to: t.token,
          title: message.title,
          body: message.body,
          sound: 'default',
          priority: 'high',
          channelId: 'meetups',
          data: message.meetupId
            ? { meetupId: message.meetupId, url: `/meetup/${message.meetupId}` }
            : { url: '/notifications' },
        },
      });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let sent = 0;
  const staleTokens: string[] = [];
  for (let i = 0; i < outgoing.length; i += 100) {
    const chunk = outgoing.slice(i, i + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk.map((c) => c.payload)),
    });
    if (!response.ok) {
      console.error('Expo push failed', response.status, await response.text());
      continue;
    }
    const result = await response.json();
    const tickets: { status: string; details?: { error?: string }; message?: string }[] = result.data ?? [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        sent++;
      } else {
        console.error('Push ticket error', ticket.message, ticket.details);
        if (ticket.details?.error === 'DeviceNotRegistered') staleTokens.push(chunk[index].token);
      }
    });
  }

  if (staleTokens.length > 0) {
    await admin.from('push_tokens').delete().in('token', staleTokens);
  }
  return sent;
}
