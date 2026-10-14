import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, Screen } from '@/components/ui';
import { fetchNotifications, markNotificationsRead } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { colors, font, spacing } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';
import type { IconName } from '@/components/ui';

const ICONS: Record<string, IconName> = {
  created: 'flame',
  updated: 'create',
  confirmed: 'checkmark-done',
  cancelled: 'close-circle',
  reminder: 'alarm',
  test: 'paper-plane',
};

/** In-app overview of all invitations – also filled when push notifications are switched off. */
export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setItems(await fetchNotifications().catch(() => []));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().then(() => markNotificationsRead());
    }, [load]),
  );

  return (
    <Screen
      edges={[]}
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
      {items?.length === 0 && <EmptyState icon="notifications-outline" title="Keine Mitteilungen" text="Einladungen deiner Gruppe erscheinen hier." />}
      {items?.map((n) => (
        <Card
          key={n.id}
          onPress={n.meetup_id ? () => router.push(`/meetup/${n.meetup_id}`) : undefined}
          style={!n.read_at && { borderColor: colors.accent }}
        >
          <View style={styles.row}>
            <Ionicons name={ICONS[n.type] ?? 'notifications'} size={22} color={colors.accent} />
            <Text style={[font.body, { fontWeight: '700', flex: 1 }]}>{n.title}</Text>
            <Text style={font.small}>{formatRelative(n.created_at)}</Text>
          </View>
          <Text style={font.muted}>{n.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
