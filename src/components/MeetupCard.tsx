import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { formatWhen } from '@/lib/format';
import { colors, font, spacing } from '@/lib/theme';
import type { Meetup } from '@/lib/types';
import { RSVP_META } from './RsvpButtons';
import { Avatar, Badge, Card } from './ui';

export function MeetupCard({ meetup, userId, showGroup }: { meetup: Meetup; userId: string; showGroup?: boolean }) {
  const yes = meetup.rsvps.filter((r) => r.status === 'yes').length;
  const maybe = meetup.rsvps.filter((r) => r.status === 'maybe').length;
  const mine = meetup.rsvps.find((r) => r.user_id === userId)?.status ?? null;
  const cancelled = meetup.status === 'cancelled';
  const voting = meetup.status === 'voting';

  return (
    <Card onPress={() => router.push(`/meetup/${meetup.id}`)} style={cancelled && { opacity: 0.6 }}>
      <View style={styles.header}>
        <Avatar name={meetup.creator?.display_name} url={meetup.creator?.avatar_url} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={font.small}>
            {meetup.creator?.id === userId ? 'Du lädst ein' : `${meetup.creator?.display_name ?? 'Jemand'} lädt ein`}
            {showGroup && meetup.group ? ` · ${meetup.group.name}` : ''}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {voting ? 'Wann & wo?' : meetup.bar?.name ?? 'Bar'}
          </Text>
        </View>
        {cancelled && <Badge label="Abgesagt" color={colors.no} />}
        {voting && <Badge label="Abstimmung" color={colors.amber} />}
      </View>
      {meetup.starts_at && (
        <View style={styles.row}>
          <Ionicons name="time-outline" size={18} color={colors.accent} />
          <Text style={[font.body, { textDecorationLine: cancelled ? 'line-through' : 'none' }]}>
            {formatWhen(meetup.starts_at)}
          </Text>
        </View>
      )}
      {meetup.message ? (
        <Text style={font.muted} numberOfLines={2}>
          „{meetup.message}“
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={font.small}>
          <Text style={{ color: colors.yes, fontWeight: '700' }}>{yes} dabei</Text>
          {maybe > 0 ? <Text>{`  ·  ${maybe} vielleicht`}</Text> : null}
        </Text>
        {mine ? (
          <View style={styles.row}>
            <Ionicons name={RSVP_META[mine].icon} size={16} color={RSVP_META[mine].color} />
            <Text style={[font.small, { color: RSVP_META[mine].color, fontWeight: '700' }]}>{RSVP_META[mine].label}</Text>
          </View>
        ) : !cancelled ? (
          <Badge label="Antwort offen" />
        ) : null}
      </View>
    </Card>
  );
}


const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
});
