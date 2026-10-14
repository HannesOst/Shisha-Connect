import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SourceBadge } from '@/components/BarRow';
import { RSVP_META, RsvpButtons } from '@/components/RsvpButtons';
import { Avatar, Badge, Button, Card, EmptyState, Notice, Screen, SectionTitle } from '@/components/ui';
import { useRealtime } from '@/hooks/useRealtime';
import {
  cancelMeetup,
  confirmOption,
  fetchGroupMembers,
  fetchMeetup,
  markNotificationsRead,
  setRsvp,
  setVote,
  type NotifyResult,
} from '@/lib/api';
import { formatOpeningHours, navigationUrl } from '@/lib/bars';
import { formatLongDay, formatTime, formatWhen } from '@/lib/format';
import { colors, font, radius, spacing } from '@/lib/theme';
import type { GroupMember, Meetup, PublicProfile, RsvpStatus } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

function notifyMessage(result: NotifyResult): string {
  if ('error' in result) return `Gespeichert, aber die Benachrichtigung ist fehlgeschlagen: ${result.error}`;
  return `${result.recipients} ${result.recipients === 1 ? 'Person wurde' : 'Personen wurden'} benachrichtigt.`;
}

export default function MeetupScreen() {
  const { id, notified } = useLocalSearchParams<{ id: string; notified?: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;
  const [meetup, setMeetup] = useState<Meetup | null | undefined>(undefined);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchMeetup(id);
      setMeetup(next);
      if (next) setMembers(await fetchGroupMembers(next.group_id));
    } catch (error) {
      console.warn(error);
      setMeetup((prev) => (prev === undefined ? null : prev));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      markNotificationsRead(id).catch(() => undefined);
    }, [load, id]),
  );

  // Answers and votes of everybody update live.
  useRealtime(
    `meetup:${id}`,
    [
      { table: 'meetups', filter: `id=eq.${id}` },
      { table: 'rsvps', filter: `meetup_id=eq.${id}` },
      { table: 'option_votes', filter: `meetup_id=eq.${id}` },
    ],
    load,
  );

  if (meetup === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (meetup === null) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle-outline" title="Treffen nicht gefunden" text="Es wurde gelöscht oder gehört zu einer anderen Gruppe." />
      </Screen>
    );
  }

  const isCreator = meetup.created_by === userId;
  const cancelled = meetup.status === 'cancelled';
  const voting = meetup.status === 'voting';
  const myRsvp = meetup.rsvps.find((r) => r.user_id === userId)?.status ?? null;
  const profiles = new Map<string, PublicProfile>(members.map((m) => [m.profile.id, m.profile]));
  const answered = new Set(meetup.rsvps.map((r) => r.user_id));
  const pending = members.filter((m) => !answered.has(m.profile.id));
  const byStatus = (status: RsvpStatus) => meetup.rsvps.filter((r) => r.status === status);

  const answer = async (status: RsvpStatus) => {
    // Optimistic update – realtime confirms it.
    setMeetup({
      ...meetup,
      rsvps: [...meetup.rsvps.filter((r) => r.user_id !== userId), { user_id: userId, status, updated_at: new Date().toISOString() }],
    });
    try {
      await setRsvp(meetup.id, status);
    } catch (error) {
      Alert.alert('Antwort nicht gespeichert', error instanceof Error ? error.message : String(error));
      load();
    }
  };

  const toggleVote = async (optionId: string, voted: boolean) => {
    setBusy(optionId);
    try {
      await setVote(meetup.id, optionId, !voted);
      await load();
    } catch (error) {
      Alert.alert('Stimme nicht gespeichert', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const decide = (optionId: string, label: string) => {
    Alert.alert('Diese Option festlegen?', `${label}\n\nAlle in der Gruppe werden benachrichtigt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Festlegen',
        onPress: async () => {
          setBusy(optionId);
          try {
            const result = await confirmOption(meetup.id, optionId);
            await load();
            Alert.alert('Entschieden!', notifyMessage(result));
          } catch (error) {
            Alert.alert('Fehler', error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const cancel = () => {
    Alert.alert('Treffen absagen?', 'Alle Teilnehmenden erhalten eine Benachrichtigung.', [
      { text: 'Nein', style: 'cancel' },
      {
        text: 'Absagen',
        style: 'destructive',
        onPress: async () => {
          setBusy('cancel');
          try {
            const result = await cancelMeetup(meetup.id);
            await load();
            Alert.alert('Abgesagt', notifyMessage(result));
          } catch (error) {
            Alert.alert('Fehler', error instanceof Error ? error.message : String(error));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const bar = meetup.bar;
  const hours = formatOpeningHours(bar?.opening_hours);
  const maxVotes = Math.max(0, ...(meetup.options ?? []).map((o) => o.votes.length));

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
      <Stack.Screen options={{ title: meetup.group?.name ?? 'Treffen' }} />

      {notified && (
        <Notice icon="paper-plane">
          <Text style={font.body}>
            {notified === 'error'
              ? 'Treffen gespeichert, aber die Push-Benachrichtigung ist fehlgeschlagen. Prüfe die Einrichtung (README).'
              : `Veröffentlicht! ${notified} ${notified === '1' ? 'Person wurde' : 'Personen wurden'} benachrichtigt.`}
          </Text>
        </Notice>
      )}
      {cancelled && (
        <Notice tone="warning" icon="close-circle">
          <Text style={font.body}>Dieses Treffen wurde abgesagt.</Text>
        </Notice>
      )}

      <Card>
        <View style={styles.creatorRow}>
          <Avatar name={meetup.creator?.display_name} url={meetup.creator?.avatar_url} size={36} />
          <Text style={[font.muted, { flex: 1 }]}>
            {isCreator ? 'Du lädst ein' : `${meetup.creator?.display_name ?? 'Jemand'} lädt ein`}
          </Text>
          {voting && <Badge label="Abstimmung läuft" color={colors.amber} />}
        </View>
        {voting ? (
          <Text style={font.title}>Wann & wo?</Text>
        ) : (
          <>
            <Text style={font.title}>{bar?.name ?? 'Bar'}</Text>
            {meetup.starts_at && (
              <View style={styles.infoRow}>
                <Ionicons name="time" size={22} color={colors.accent} />
                <View>
                  <Text style={[font.h2, cancelled && { textDecorationLine: 'line-through' }]}>{formatTime(meetup.starts_at)} Uhr</Text>
                  <Text style={font.muted}>{formatLongDay(meetup.starts_at)}</Text>
                </View>
              </View>
            )}
            {bar && (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={22} color={colors.accent} />
                <View style={{ flex: 1, gap: 4 }}>
                  {bar.address ? <Text style={font.body}>{bar.address}</Text> : null}
                  <SourceBadge source={bar.source} />
                  {hours ? <Text style={font.small}>{hours}</Text> : null}
                </View>
              </View>
            )}
          </>
        )}
        {meetup.message ? <Text style={[font.body, styles.message]}>„{meetup.message}“</Text> : null}
        {bar && !voting && bar.source !== 'sample' && (
          <Button title="Navigation starten" icon="navigate" variant="secondary" small onPress={() => Linking.openURL(navigationUrl(bar))} />
        )}
        <Text style={[font.small, { color: colors.textFaint }]}>Keine automatische Reservierung – bei Bedarf bitte selbst reservieren.</Text>
      </Card>

      {voting && meetup.options && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>Vorschläge</SectionTitle>
          <Text style={font.small}>Tippe alle Optionen an, die für dich passen.{isCreator ? ' Danach legst du die finale Auswahl fest.' : ''}</Text>
          {meetup.options.map((option) => {
            const voted = option.votes.some((v) => v.user_id === userId);
            const label = `${option.bar?.name ?? 'Bar'} · ${formatWhen(option.starts_at)}`;
            const leading = option.votes.length > 0 && option.votes.length === maxVotes;
            return (
              <View key={option.id} style={[styles.option, voted && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                <Pressable style={styles.optionMain} onPress={() => toggleVote(option.id, voted)} disabled={!!busy}>
                  <Ionicons name={voted ? 'checkbox' : 'square-outline'} size={26} color={voted ? colors.accent : colors.textMuted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[font.body, { fontWeight: '700' }]}>{option.bar?.name ?? 'Bar'}</Text>
                    <Text style={font.muted}>{formatWhen(option.starts_at)}</Text>
                    <View style={styles.voters}>
                      {option.votes.map((v) => (
                        <Avatar key={v.user_id} name={profiles.get(v.user_id)?.display_name} url={profiles.get(v.user_id)?.avatar_url} size={22} />
                      ))}
                    </View>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.voteCount, leading && { color: colors.accent }]}>{option.votes.length}</Text>
                    <Text style={font.small}>{option.votes.length === 1 ? 'Stimme' : 'Stimmen'}</Text>
                  </View>
                </Pressable>
                {isCreator && (
                  <Button title="Diese Option festlegen" small variant={leading ? 'primary' : 'secondary'} loading={busy === option.id} onPress={() => decide(option.id, label)} />
                )}
              </View>
            );
          })}
        </View>
      )}

      {!cancelled && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{voting ? 'Bist du grundsätzlich dabei?' : 'Bist du dabei?'}</SectionTitle>
          <RsvpButtons value={myRsvp} onChange={answer} />
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <SectionTitle right={<Text style={font.small}>{byStatus('yes').length} von {members.length} dabei</Text>}>Teilnehmer</SectionTitle>
        {(['yes', 'maybe', 'no'] as RsvpStatus[]).map((status) => {
          const list = byStatus(status);
          if (list.length === 0) return null;
          return (
            <View key={status} style={styles.group}>
              <View style={styles.groupHeader}>
                <Ionicons name={RSVP_META[status].icon} size={20} color={RSVP_META[status].color} />
                <Text style={[font.body, { fontWeight: '700', color: RSVP_META[status].color }]}>
                  {RSVP_META[status].label} ({list.length})
                </Text>
              </View>
              {list.map((r) => (
                <PersonRow key={r.user_id} profile={profiles.get(r.user_id)} you={r.user_id === userId} />
              ))}
            </View>
          );
        })}
        {pending.length > 0 && (
          <View style={styles.group}>
            <View style={styles.groupHeader}>
              <Ionicons name="hourglass-outline" size={20} color={colors.textMuted} />
              <Text style={[font.body, { fontWeight: '700', color: colors.textMuted }]}>Noch keine Antwort ({pending.length})</Text>
            </View>
            {pending.map((m) => (
              <PersonRow key={m.profile.id} profile={m.profile} you={m.profile.id === userId} />
            ))}
          </View>
        )}
      </View>

      {isCreator && !cancelled && (
        <View style={{ gap: spacing.sm }}>
          {!voting && (
            <Button title="Bar oder Uhrzeit ändern" icon="create-outline" variant="secondary" onPress={() => router.push(`/meetup/edit/${meetup.id}`)} />
          )}
          <Button title={voting ? 'Abstimmung absagen' : 'Treffen absagen'} icon="close-circle-outline" variant="danger" loading={busy === 'cancel'} onPress={cancel} />
        </View>
      )}
    </Screen>
  );
}

function PersonRow({ profile, you }: { profile?: PublicProfile; you: boolean }) {
  return (
    <View style={styles.person}>
      <Avatar name={profile?.display_name} url={profile?.avatar_url} size={32} />
      <Text style={font.body}>
        {profile?.display_name ?? 'Ehemaliges Mitglied'}
        {you ? ' (du)' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  message: { fontStyle: 'italic', color: colors.textMuted },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voteCount: { color: colors.text, fontSize: 24, fontWeight: '800' },
  voters: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  group: { backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.xs },
});
