import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { createGroup, joinGroup } from '@/lib/api';
import { colors, font, spacing } from '@/lib/theme';
import type { Group } from '@/lib/types';
import { useGroups } from '@/providers/GroupsProvider';
import { Button, Card, Field } from './ui';

export const PENDING_INVITE_KEY = 'shisha.pendingInvite';

/** Join a group by code or found a new one. */
export function GroupSetup({ onDone }: { onDone?: (group: Group) => void }) {
  const { refresh, setActiveGroupId } = useGroups();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'join' | 'create' | null>(null);

  // Invite link opened before sign up → code is prefilled.
  useEffect(() => {
    AsyncStorage.getItem(PENDING_INVITE_KEY).then((pending) => pending && setCode(pending));
  }, []);

  const finish = async (group: Group) => {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    setActiveGroupId(group.id);
    await refresh();
    onDone?.(group);
  };

  const join = async () => {
    setBusy('join');
    try {
      await finish(await joinGroup(code));
    } catch (error) {
      Alert.alert('Beitritt nicht möglich', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setBusy('create');
    try {
      await finish(await createGroup(name.trim()));
    } catch (error) {
      Alert.alert('Gruppe konnte nicht erstellt werden', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Text style={font.h2}>Einer Gruppe beitreten</Text>
        <Text style={font.muted}>Gib den 6-stelligen Gruppencode ein, den du von deinen Freunden bekommen hast.</Text>
        <Field
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="z. B. K7M2QX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '800' }}
        />
        <Button title="Beitreten" icon="enter-outline" onPress={join} loading={busy === 'join'} disabled={code.trim().length < 6 || !!busy} />
      </Card>
      <Text style={[font.muted, { textAlign: 'center', color: colors.textFaint }]}>oder</Text>
      <Card>
        <Text style={font.h2}>Neue Gruppe gründen</Text>
        <Field value={name} onChangeText={setName} placeholder="z. B. Shisha-Freitag" maxLength={50} />
        <Button title="Gruppe gründen" icon="people-outline" variant="secondary" onPress={create} loading={busy === 'create'} disabled={!name.trim() || !!busy} />
      </Card>
    </View>
  );
}
