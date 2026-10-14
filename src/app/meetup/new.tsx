import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarPicker } from '@/components/BarPicker';
import { SourceBadge } from '@/components/BarRow';
import { TimePicker } from '@/components/TimePicker';
import { Button, Card, Chip, Field, Notice } from '@/components/ui';
import { createMeetup } from '@/lib/api';
import { formatWhen } from '@/lib/format';
import { colors, font, radius, spacing } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';
import { useBarSearch } from '@/providers/BarSearchProvider';
import { useGroups } from '@/providers/GroupsProvider';

const STEPS = ['Wo?', 'Wann?', 'Einladen'];

export default function NewMeetupScreen() {
  const params = useLocalSearchParams<{ barKey?: string }>();
  const { groups, activeGroup } = useGroups();
  const { results, favorites } = useBarSearch();
  // Coming from the bar list ("Treffen hier planen") → bar preselected, start with the time.
  const [preselected] = useState(() => [...favorites, ...results].find((b) => b.key === params.barKey) ?? null);
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [voting, setVoting] = useState(false);
  const [bars, setBars] = useState<BarCandidate[]>(preselected ? [preselected] : []);
  const [times, setTimes] = useState<Date[]>([]);
  const [message, setMessage] = useState('');
  const [groupId, setGroupId] = useState(activeGroup?.id ?? groups[0]?.id);
  const [busy, setBusy] = useState(false);

  const toggleBar = (bar: BarCandidate) => {
    const selected = bars.some((b) => b.key === bar.key);
    if (!voting) {
      setBars(selected ? [] : [bar]);
      return;
    }
    if (selected) setBars(bars.filter((b) => b.key !== bar.key));
    else if (bars.length < 3) setBars([...bars, bar]);
    else Alert.alert('Maximal 3 Bars', 'Für eine übersichtliche Abstimmung kannst du bis zu 3 Bars vorschlagen.');
  };

  const setVotingMode = (value: boolean) => {
    setVoting(value);
    if (!value) {
      setBars(bars.slice(0, 1));
      setTimes(times.slice(0, 1));
    }
  };

  const optionCount = bars.length * times.length;
  const isVote = optionCount > 1;
  const canContinue = step === 0 ? bars.length > 0 : step === 1 ? times.length > 0 : !!groupId;

  const publish = async () => {
    if (!groupId) return;
    if (times.some((t) => t.getTime() < Date.now() - 5 * 60 * 1000)) {
      Alert.alert('Zeit liegt in der Vergangenheit', 'Bitte wähle eine Uhrzeit in der Zukunft.');
      return;
    }
    setBusy(true);
    try {
      const result = await createMeetup({ groupId, message, bars, times });
      const notified = 'recipients' in result.notify ? String(result.notify.recipients) : 'error';
      router.replace({ pathname: '/meetup/[id]', params: { id: result.id, notified } });
    } catch (error) {
      Alert.alert('Treffen konnte nicht erstellt werden', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <View style={styles.steps}>
        {STEPS.map((label, i) => (
          <View key={label} style={[styles.step, i <= step && { backgroundColor: colors.accent }]}>
            <Text style={[styles.stepText, i <= step && { color: colors.onAccent }]}>
              {i + 1}. {label}
            </Text>
          </View>
        ))}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { fontWeight: '700' }]}>Abstimmung</Text>
                  <Text style={font.small}>Mehrere Bars oder Uhrzeiten vorschlagen – du entscheidest danach.</Text>
                </View>
                <Switch value={voting} onValueChange={setVotingMode} trackColor={{ true: colors.accent, false: colors.border }} />
              </View>
              <BarPicker selected={bars} onToggle={toggleBar} />
            </>
          )}

          {step === 1 && <TimePicker times={times} onChange={setTimes} multi={voting} />}

          {step === 2 && (
            <>
              {groups.length > 1 && (
                <View style={{ gap: spacing.sm }}>
                  <Text style={font.small}>Gruppe</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {groups.map((g) => (
                      <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => setGroupId(g.id)} />
                    ))}
                  </View>
                </View>
              )}
              <Card>
                <Text style={font.small}>{isVote ? `Abstimmung mit ${optionCount} Vorschlägen` : 'Zusammenfassung'}</Text>
                {bars.map((b) => (
                  <View key={b.key} style={styles.summaryRow}>
                    <Ionicons name="location" size={20} color={colors.accent} />
                    <Text style={[font.body, { fontWeight: '700', flex: 1 }]}>{b.name}</Text>
                    <SourceBadge source={b.source} />
                  </View>
                ))}
                {times.map((t) => (
                  <View key={t.toISOString()} style={styles.summaryRow}>
                    <Ionicons name="time" size={20} color={colors.accent} />
                    <Text style={[font.body, { fontWeight: '700' }]}>{formatWhen(t)}</Text>
                  </View>
                ))}
              </Card>
              <Field
                label="Nachricht (optional)"
                value={message}
                onChangeText={setMessage}
                placeholder="Wer hat heute Lust auf eine gemütliche Runde?"
                multiline
                maxLength={280}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />
              <Notice icon="information-circle">
                <Text style={font.small}>
                  Alle in der Gruppe erhalten eine Push-Nachricht. Es wird keine Reservierung bei der Bar vorgenommen.
                </Text>
              </Notice>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={styles.footer}>
        {step > 0 && <Button title="Zurück" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        {step < 2 ? (
          <Button title="Weiter" icon="arrow-forward" onPress={() => setStep(step + 1)} disabled={!canContinue} style={{ flex: 2 }} />
        ) : (
          <Button
            title={isVote ? 'Abstimmung starten' : 'Freunde einladen'}
            icon="paper-plane"
            onPress={publish}
            loading={busy}
            disabled={!canContinue}
            style={{ flex: 2 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  step: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  stepText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
