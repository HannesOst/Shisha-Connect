import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { countUnreadNotifications } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useRealtime } from './useRealtime';

export function useUnreadCount(): number {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    countUnreadNotifications().then(setCount);
  }, []);
  useFocusEffect(load);
  useRealtime(userId && `unread:${userId}`, [{ table: 'notifications', filter: `user_id=eq.${userId}` }], load);
  return count;
}
