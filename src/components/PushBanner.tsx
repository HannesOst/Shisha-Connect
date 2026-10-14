import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { getPushPermission, registerForPush, type PushPermission } from '@/lib/push';
import { font } from '@/lib/theme';
import { Button, Notice } from './ui';

/** Explains why push is useful and asks for permission; points to the settings if it was denied. */
export function PushBanner() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPushPermission().then(setPermission).catch(() => setPermission(null));
    }, []),
  );

  if (permission === null || (permission === 'granted' && !problem)) return null;

  if (permission === 'granted' && problem) {
    return (
      <Notice tone="warning" icon="warning">
        <Text style={font.body}>Push ist erlaubt, aber dieses Gerät konnte nicht registriert werden: {problem}</Text>
      </Notice>
    );
  }

  if (permission === 'denied') {
    return (
      <Notice tone="warning" icon="notifications-off">
        <Text style={font.body}>
          Benachrichtigungen sind ausgeschaltet. Du verpasst Einladungen, solange die App geschlossen ist – sie landen
          aber weiterhin in deiner Mitteilungsübersicht (Glocke oben rechts).
        </Text>
        <Button title="Einstellungen öffnen" icon="settings-outline" variant="secondary" small onPress={() => Linking.openSettings()} />
      </Notice>
    );
  }

  return (
    <Notice icon="notifications">
      <Text style={font.body}>
        Damit du sofort erfährst, wenn jemand zur Shisha einlädt, braucht die App deine Erlaubnis für Mitteilungen.
      </Text>
      <Button
        title="Benachrichtigungen erlauben"
        icon="notifications-outline"
        small
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const result = await registerForPush(true);
          setBusy(false);
          setPermission(await getPushPermission());
          setProblem(result.ok || result.reason === 'denied' ? null : result.message);
        }}
      />
    </Notice>
  );
}
