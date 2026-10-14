import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, Chip, Screen, SectionTitle } from '@/components/ui';
import { fetchGroupMembers, leaveGroup, regenerateInviteCode } from '@/lib/api';
import { colors, font, spacing } from '@/lib/theme';
import type { GroupMember } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useGroups } from '@/providers/GroupsProvider';

export default function GroupScreen() {
  const { session } = useAuth();
  const { groups, activeGroup, setActiveGroupId, refresh } = useGroups();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const userId = session!.user.id;
  const groupId = activeGroup?.id;

  useFocusEffect(
    useCallback(() => {
      if (groupId) fetchGroupMembers(groupId).then(setMembers).catch(() => undefined);
    }, [groupId]),
  );

  if (!activeGroup) return null;
  const isAdmin = members.some((m) => m.profile.id === userId && m.role === 'admin');
  const inviteLink = Linking.createURL(`/join/${activeGroup.invite_code}`);

  const share = () =>
    Share.share({
      message:
        `Komm in unsere Shisha-Gruppe „${activeGroup.name}“ bei Shisha Connect!\n\n` +
        `Gruppencode: ${activeGroup.invite_code}\n` +
        `Direkt öffnen (App installiert): ${inviteLink}`,
    });

  const renew = () =>
    Alert.alert('Neuen Code erzeugen?', 'Der alte Code und Link funktionieren danach nicht mehr.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Erneuern',
        onPress: async () => {
          try {
            await regenerateInviteCode(activeGroup.id);
            await refresh();
          } catch (error) {
            Alert.alert('Fehler', error instanceof Error ? error.message : String(error));
          }
        },
      },
    ]);

  const leave = () =>
    Alert.alert(`„${activeGroup.name}“ verlassen?`, 'Du siehst danach keine Treffen dieser Gruppe mehr.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Verlassen',
        style: 'destructive',
        onPress: async () => {
          await leaveGroup(activeGroup.id);
          await refresh();
        },
      },
    ]);

  return (
    <Screen>
      <Text style={font.title}>Gruppe</Text>
      {groups.length > 1 && (
        <View style={styles.chips}>
          {groups.map((g) => (
            <Chip key={g.id} label={g.name} selected={g.id === activeGroup.id} onPress={() => setActiveGroupId(g.id)} />
          ))}
        </View>
      )}

      <Card>
        <Text style={font.h2}>{activeGroup.name}</Text>
        <Text style={font.muted}>Private Gruppe · nur Mitglieder sehen Treffen und Teilnehmer.</Text>
        <View style={styles.codeBox}>
          <Text style={font.small}>Gruppencode</Text>
          <Text style={styles.code} selectable>
            {activeGroup.invite_code}
          </Text>
        </View>
        <Button title="Freunde einladen" icon="share-social" onPress={share} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="Code kopieren"
            icon="copy-outline"
            variant="secondary"
            small
            style={{ flex: 1 }}
            onPress={async () => {
              await Clipboard.setStringAsync(activeGroup.invite_code);
              Alert.alert('Kopiert', 'Der Gruppencode ist in der Zwischenablage.');
            }}
          />
          {isAdmin && <Button title="Code erneuern" icon="refresh" variant="secondary" small style={{ flex: 1 }} onPress={renew} />}
        </View>
      </Card>

      <SectionTitle right={<Text style={font.small}>{members.length}</Text>}>Mitglieder</SectionTitle>
      <Card>
        {members.map((m) => (
          <View key={m.profile.id} style={styles.member}>
            <Avatar name={m.profile.display_name} url={m.profile.avatar_url} />
            <Text style={[font.body, { flex: 1 }]}>
              {m.profile.display_name}
              {m.profile.id === userId ? ' (du)' : ''}
            </Text>
            {m.role === 'admin' && <Badge label="Admin" />}
          </View>
        ))}
      </Card>

      <Button title="Weitere Gruppe beitreten oder gründen" icon="add" variant="secondary" onPress={() => router.push('/group-add')} />
      <Button title="Gruppe verlassen" icon="exit-outline" variant="danger" onPress={leave} />
      <View style={styles.hint}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textFaint} />
        <Text style={[font.small, { flex: 1, color: colors.textFaint }]}>
          Der Link öffnet die App direkt, wenn sie installiert ist. Sonst einfach den Gruppencode eingeben.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  codeBox: { alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
  code: { color: colors.accent, fontSize: 36, fontWeight: '900', letterSpacing: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  hint: { flexDirection: 'row', gap: spacing.sm },
});
