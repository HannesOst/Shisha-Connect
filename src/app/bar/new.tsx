import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Chip, Field, Screen } from '@/components/ui';
import { addManualBar } from '@/lib/api';
import { geocode } from '@/lib/bars';
import { font, spacing } from '@/lib/theme';
import { useBarSearch } from '@/providers/BarSearchProvider';
import { useGroups } from '@/providers/GroupsProvider';

export default function NewBarScreen() {
  const { groups, activeGroup } = useGroups();
  const { reloadGroupBars } = useBarSearch();
  const [groupId, setGroupId] = useState(activeGroup?.id);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!groupId) return;
    setBusy(true);
    try {
      // Try to place the bar on the map; saving works without coordinates too.
      const position = address.trim() ? await geocode(address.trim()).catch(() => null) : null;
      await addManualBar(groupId, {
        name: name.trim(),
        address: address.trim() || null,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
        opening_hours: hours.trim() || null,
      });
      await reloadGroupBars();
      if (address.trim() && !position) {
        Alert.alert('Bar gespeichert', 'Die Adresse wurde nicht auf der Karte gefunden – die Bar erscheint trotzdem in der Liste.');
      }
      router.back();
    } catch (error) {
      Alert.alert('Nicht gespeichert', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text style={font.muted}>Die Bar ist danach für alle in deiner Gruppe sichtbar.</Text>
      {groups.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {groups.map((g) => (
            <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => setGroupId(g.id)} />
          ))}
        </View>
      )}
      <Field label="Name der Bar" value={name} onChangeText={setName} maxLength={80} placeholder="z. B. Lounge am See" />
      <Field label="Adresse" value={address} onChangeText={setAddress} placeholder="Strasse Nr., PLZ Ort" />
      <Field label="Öffnungszeiten (optional)" value={hours} onChangeText={setHours} placeholder="z. B. Mo-So 18:00-02:00" />
      <Button title="Bar speichern" icon="checkmark" onPress={save} loading={busy} disabled={!name.trim()} />
    </Screen>
  );
}
