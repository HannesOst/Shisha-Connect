import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS_OPTIONS, useBarSearch } from '@/providers/BarSearchProvider';
import { colors, font, radius, spacing } from '@/lib/theme';
import { Chip, Notice } from './ui';

/** Location (GPS or typed place) + radius selection for the bar search. */
export function LocationControls() {
  const { origin, radiusKm, setRadiusKm, locateMe, searchPlace, loading, error, usingSampleData } = useBarSearch();
  const [query, setQuery] = useState('');

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={origin ? `In der Nähe von: ${origin.label}` : 'Ort oder PLZ eingeben'}
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => searchPlace(query).then((ok) => ok && setQuery(''))}
          />
          {loading && <ActivityIndicator color={colors.accent} />}
        </View>
        <Pressable style={styles.gpsButton} onPress={locateMe} accessibilityLabel="Meinen Standort verwenden">
          <Ionicons name="locate" size={24} color={colors.onAccent} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {RADIUS_OPTIONS.map((km) => (
          <Chip key={km} label={`${km} km`} selected={radiusKm === km} onPress={() => setRadiusKm(km)} />
        ))}
      </ScrollView>

      {!origin && (
        <Notice icon="location">
          <Text style={font.body}>
            Tippe auf den Standort-Knopf, um Bars in deiner Nähe zu finden – oder gib einen Ort ein. Dein Standort wird
            nur auf deinem Handy verwendet und nicht gespeichert.
          </Text>
        </Notice>
      )}
      {usingSampleData && (
        <Notice tone="warning" icon="flask">
          <Text style={font.body}>
            {error} Angezeigt werden BEISPIELDATEN – das sind keine echten Bars. Ziehe nach unten, um es erneut zu versuchen.
          </Text>
        </Notice>
      )}
      {!usingSampleData && error && (
        <Text style={[font.small, { color: colors.maybe }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 14 },
  gpsButton: {
    width: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
