import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MeetupCard } from '@/components/MeetupCard';
import { PushBanner } from '@/components/PushBanner';
import { Button, EmptyState, IconButton, Screen, SectionTitle } from '@/components/ui';
import { useRealtime } from '@/hooks/useRealtime';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { fetchUpcomingMeetups } from '@/lib/api';
import { colors, font, radius, spacing } from '@/lib/theme';
import type { Meetup } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useGroups } from '@/providers/GroupsProvider';

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const { groups } = useGroups();
  const userId = session!.user.id;
  const unread = useUnreadCount();
  const [meetups, setMeetups] = useState<Meetup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setMeetups(await fetchUpcomingMeetups());
      setLoadedAt(Date.now());
    } catch (error) {
      console.warn(error);
      setMeetups((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useRealtime(`home:${userId}`, [{ table: 'meetups' }, { table: 'rsvps' }], load);

  const active = (meetups ?? []).filter((m) => m.status !== 'cancelled');
  const myStatus = (m: Meetup) => m.rsvps.find((r) => r.user_id === userId)?.status ?? null;
  const next = active.find(
    (m) => m.status === 'confirmed' && m.starts_at && new Date(m.starts_at).getTime() > loadedAt - 3 * 3600e3 && ['yes', 'maybe'].includes(myStatus(m) ?? ''),
  );
  const open = active.filter((m) => m.id !== next?.id && m.created_by !== userId && !myStatus(m));
  const rest = (meetups ?? []).filter((m) => m.id !== next?.id && !open.includes(m));
  const showGroup = groups.length > 1;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.muted}>Hallo {profile?.display_name ?? ''} 👋</Text>
          <Text style={font.title}>Treffen</Text>
        </View>
        <IconButton icon="notifications-outline" label="Mitteilungen" onPress={() => router.push('/notifications')}>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </IconButton>
      </View>

      <PushBanner />

      <Button title="Treffen erstellen" icon="add-circle" onPress={() => router.push('/meetup/new')} style={styles.cta} />

      {next && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>Dein nächstes Treffen</SectionTitle>
          <MeetupCard meetup={next} userId={userId} showGroup={showGroup} />
        </View>
      )}

      {open.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>Offene Einladungen</SectionTitle>
          {open.map((m) => (
            <MeetupCard key={m.id} meetup={m} userId={userId} showGroup={showGroup} />
          ))}
        </View>
      )}

      {rest.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>Weitere Treffen</SectionTitle>
          {rest.map((m) => (
            <MeetupCard key={m.id} meetup={m} userId={userId} showGroup={showGroup} />
          ))}
        </View>
      )}

      {meetups && meetups.length === 0 && (
        <EmptyState icon="cafe-outline" title="Noch nichts geplant" text="Lade deine Freunde zur nächsten Runde ein – das dauert nur ein paar Sekunden." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.onAccent, fontSize: 12, fontWeight: '800' },
  cta: { minHeight: 64 },
});
