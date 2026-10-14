import { useEffect, useEffectEvent } from 'react';
import { supabase } from '@/lib/supabase';

type Subscription = { table: string; filter?: string };

/**
 * Calls `onChange` whenever one of the given tables changes (Supabase Realtime, RLS-filtered).
 * Used so RSVPs and votes update live for every member.
 */
export function useRealtime(key: string | null, subscriptions: Subscription[], onChange: () => void) {
  const handleChange = useEffectEvent(onChange);
  const signature = JSON.stringify(subscriptions);

  useEffect(() => {
    if (!key) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handleChange(), 250);
    };
    const channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2)}`);
    for (const sub of JSON.parse(signature) as Subscription[]) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: sub.table, ...(sub.filter ? { filter: sub.filter } : {}) },
        debounced,
      );
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, signature]);
}
