import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchMyGroups } from '@/lib/api';
import type { Group } from '@/lib/types';
import { useAuth } from './AuthProvider';

const ACTIVE_KEY = 'shisha.activeGroup';

type GroupsContextValue = {
  groups: Group[];
  activeGroup: Group | null;
  loading: boolean;
  setActiveGroupId: (id: string) => void;
  refresh: () => Promise<Group[]>;
};

const GroupsContext = createContext<GroupsContextValue | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const userId = session?.user.id;

  const refresh = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      return [];
    }
    try {
      const next = await fetchMyGroups();
      setGroups(next);
      return next;
    } catch (error) {
      console.warn('Gruppen konnten nicht geladen werden', error);
      return [];
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([userId ? fetchMyGroups().catch(() => []) : Promise.resolve([]), AsyncStorage.getItem(ACTIVE_KEY)]).then(
      ([next, stored]) => {
        if (cancelled) return;
        setGroups(next);
        setActiveId(stored);
        setLoadedFor(userId ?? null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loading = loadedFor !== (userId ?? null);

  const setActiveGroupId = useCallback((id: string) => {
    setActiveId(id);
    AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => undefined);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;

  const value = useMemo(
    () => ({ groups, activeGroup, loading, setActiveGroupId, refresh }),
    [groups, activeGroup, loading, setActiveGroupId, refresh],
  );
  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups(): GroupsContextValue {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups must be used inside GroupsProvider');
  return ctx;
}
