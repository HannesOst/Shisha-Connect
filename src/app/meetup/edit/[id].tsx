import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { BarPicker } from '@/components/BarPicker';
import { BarRow } from '@/components/BarRow';
import { TimePicker } from '@/components/TimePicker';
import { Button, Field, Screen, SectionTitle } from '@/components/ui';
import { fetchMeetup, updateMeetup } from '@/lib/api';
import { barKey } from '@/lib/bars';
import { colors, font, spacing } from '@/lib/theme';
import type { BarCandidate, Meetup } from '@/lib/types';

export default function EditMeetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [bar, setBar] = useState<BarCandidate | null>(null);
  const [changeBar, setChangeBar] = useState(false);
  const [times, setTimes] = useState<Date[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMeetup(id).then((m) => {
      if (!m) return;
      setMeetup(m);
      if (m.bar) setBar({ ...m.bar, key: barKey(m.bar) });
      if (m.starts_at) setTimes([new Date(m.starts_at)]);
      setMessage(m.message ?? '');
    });
  }, [id]);

  if (!meetup) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const save = async () => {
    if (!times[0]) return;
    setBusy(true);
    try {
      const barChanged = bar && bar.id !== meetup.bar?.id ? bar : null;
      const result = await updateMeetup({ meetupId: meetup.id, bar: barChanged, startsAt: times[0], message });
      if ('error' in result) Alert.alert('Gespeichert', `Die Benachrichtigung ist fehlgeschlagen: ${result.error}`);
      router.back();
    } catch (error) {
      Alert.alert('Nicht gespeichert', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <SectionTitle>Bar</SectionTitle>
      {bar && !changeBar && <BarRow bar={bar} showHours={false} />}
      {changeBar ? (
        <BarPicker
          selected={bar ? [bar] : []}
          onToggle={(b) => {
            setBar(b);
            setChangeBar(false);
          }}
        />
      ) : (
        <Button title="Andere Bar wählen" variant="ghost" icon="swap-horizontal" onPress={() => setChangeBar(true)} />
      )}
      <SectionTitle>Wann?</SectionTitle>
      <TimePicker times={times} onChange={setTimes} multi={false} />
      <Field label="Nachricht" value={message} onChangeText={setMessage} multiline maxLength={280} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <Text style={font.small}>Alle, die nicht abgesagt haben, werden über die Änderung benachrichtigt.</Text>
      <View style={{ gap: spacing.sm }}>
        <Button title="Änderungen speichern" icon="checkmark" onPress={save} loading={busy} disabled={!bar || times.length === 0} />
        <Button title="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
