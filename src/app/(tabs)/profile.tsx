import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar, Button, Card, Field, Screen, SectionTitle } from '@/components/ui';
import { sendTestPush, updateProfile, uploadAvatar } from '@/lib/api';
import { getPushPermission, registerForPush, type PushPermission } from '@/lib/push';
import { colors, font, spacing } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPushPermission().then(setPermission).catch(() => undefined);
      setName(profile?.display_name ?? '');
    }, [profile?.display_name]),
  );

  if (!profile) return null;

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      Alert.alert('Fehler', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = () =>
    run('photo', async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.base64) return;
      await uploadAvatar(asset.base64, asset.mimeType ?? 'image/jpeg');
      await refreshProfile();
    });

  const toggle = (key: 'notifications_enabled' | 'reminders_enabled', value: boolean) =>
    run(key, async () => {
      await updateProfile({ [key]: value });
      await refreshProfile();
    });

  const enablePush = () =>
    run('push', async () => {
      const result = await registerForPush(true);
      setPermission(await getPushPermission());
      if (!result.ok && result.reason !== 'denied') Alert.alert('Push nicht verfügbar', result.message);
    });

  return (
    <Screen>
      <Text style={font.title}>Profil</Text>
      <Card style={{ alignItems: 'center' }}>
        <Pressable onPress={pickPhoto} accessibilityLabel="Profilbild ändern">
          <Avatar name={profile.display_name} url={profile.avatar_url} size={96} />
        </Pressable>
        <Button title={busy === 'photo' ? 'Lädt …' : 'Foto ändern'} variant="ghost" small onPress={pickPhoto} disabled={busy === 'photo'} />
        <Text style={font.small}>{session?.user.email}</Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Field label="Name" value={name} onChangeText={setName} maxLength={40} />
        <Button
          title="Name speichern"
          variant="secondary"
          small
          disabled={!name.trim() || name.trim() === profile.display_name}
          loading={busy === 'name'}
          onPress={() =>
            run('name', async () => {
              await updateProfile({ display_name: name.trim() });
              await refreshProfile();
            })
          }
        />
      </View>

      <SectionTitle>Benachrichtigungen</SectionTitle>
      <Card>
        <ToggleRow
          title="Einladungen & Änderungen"
          text="Push-Nachricht bei neuen Treffen, Änderungen und Absagen"
          value={profile.notifications_enabled}
          onChange={(v) => toggle('notifications_enabled', v)}
        />
        <View style={styles.divider} />
        <ToggleRow
          title="Erinnerung 1 Stunde vorher"
          text="Wenn du mit „Dabei“ oder „Vielleicht“ geantwortet hast"
          value={profile.reminders_enabled}
          onChange={(v) => toggle('reminders_enabled', v)}
        />
        <View style={styles.divider} />
        <Text style={font.small}>
          Status auf diesem Gerät:{' '}
          <Text style={{ fontWeight: '700', color: permission === 'granted' ? colors.yes : colors.maybe }}>
            {permission === 'granted' ? 'erlaubt' : permission === 'denied' ? 'blockiert' : 'noch nicht gefragt'}
          </Text>
        </Text>
        {permission === 'undetermined' && <Button title="Benachrichtigungen erlauben" small loading={busy === 'push'} onPress={enablePush} />}
        {permission === 'denied' && (
          <Button title="In den Einstellungen erlauben" variant="secondary" small onPress={() => Linking.openSettings()} />
        )}
        {permission === 'granted' && (
          <Button
            title="Test-Push an mich senden"
            icon="paper-plane-outline"
            variant="secondary"
            small
            loading={busy === 'test'}
            onPress={() =>
              run('test', async () => {
                const registration = await registerForPush(false);
                if (!registration.ok) throw new Error(registration.message);
                const pushed = await sendTestPush();
                Alert.alert(
                  pushed > 0 ? 'Gesendet' : 'Nicht zugestellt',
                  pushed > 0
                    ? 'Die Test-Nachricht ist unterwegs. Schliesse die App, um zu sehen, wie sie ankommt.'
                    : 'Es wurde kein registriertes Gerät gefunden. Prüfe die Einrichtung (README).',
                );
              })
            }
          />
        )}
      </Card>

      <Button title="Abmelden" icon="log-out-outline" variant="danger" onPress={signOut} />
    </Screen>
  );
}

function ToggleRow({ title, text, value, onChange }: { title: string; text: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { fontWeight: '700' }]}>{title}</Text>
        <Text style={font.small}>{text}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.glassStrong }}
          thumbColor="#FFFFFF"
          // react-native-web uses a separate prop for the "on" thumb
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          ios_backgroundColor={colors.glassStrong} />
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
