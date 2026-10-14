import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { PENDING_INVITE_KEY } from '@/components/GroupSetup';
import { Button, Screen } from '@/components/ui';
import { joinGroup } from '@/lib/api';
import { colors, font } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useGroups } from '@/providers/GroupsProvider';

/** Target of invite links: shishaconnect://join/K7M2QX */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const { refresh, setActiveGroupId } = useGroups();
  const [state, setState] = useState<{ status: 'working' | 'done' | 'error' | 'login'; message?: string }>({ status: 'working' });

  useEffect(() => {
    const normalized = String(code ?? '').toUpperCase();
    if (!session) {
      AsyncStorage.setItem(PENDING_INVITE_KEY, normalized).then(() => setState({ status: 'login' }));
      return;
    }
    joinGroup(normalized)
      .then(async (group) => {
        setActiveGroupId(group.id);
        await refresh();
        setState({ status: 'done', message: group.name });
      })
      .catch((error) => setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }));
  }, [code, session, refresh, setActiveGroupId]);

  return (
    <Screen edges={[]} contentStyle={{ alignItems: 'stretch' }}>
      {state.status === 'working' && <ActivityIndicator color={colors.accent} size="large" />}
      {state.status === 'login' && (
        <>
          <Text style={font.h2}>Du wurdest eingeladen!</Text>
          <Text style={font.body}>Melde dich an oder erstelle ein Konto – der Gruppencode {code} ist schon vorausgefüllt.</Text>
          <Button title="Weiter" onPress={() => router.replace('/')} />
        </>
      )}
      {state.status === 'done' && (
        <>
          <Text style={font.h2}>Willkommen in „{state.message}“ 🎉</Text>
          <Button title="Zu den Treffen" onPress={() => router.replace('/')} />
        </>
      )}
      {state.status === 'error' && (
        <>
          <Text style={font.h2}>Beitritt nicht möglich</Text>
          <Text style={font.body}>{state.message}</Text>
          <Button title="Zurück" onPress={() => router.replace('/')} />
        </>
      )}
    </Screen>
  );
}
