import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useBarSearch } from '@/providers/BarSearchProvider';
import { font, spacing } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';
import { BarRow } from './BarRow';
import { LocationControls } from './LocationControls';
import { Button, EmptyState, SectionTitle } from './ui';

/** Bar selection used when creating or editing a meetup. */
export function BarPicker({
  selected,
  onToggle,
}: {
  selected: BarCandidate[];
  onToggle: (bar: BarCandidate) => void;
}) {
  const { results, favorites, origin, loading, isFavorite, toggleFavorite } = useBarSearch();
  const selectedKeys = new Set(selected.map((b) => b.key));
  const favoriteKeys = new Set(favorites.map((f) => f.key));
  const nearby = results.filter((b) => !favoriteKeys.has(b.key));

  const row = (bar: BarCandidate) => (
    <BarRow
      key={bar.key}
      bar={bar}
      showHours={false}
      selected={selectedKeys.has(bar.key)}
      onPress={() => onToggle(bar)}
      favorite={isFavorite(bar)}
      onToggleFavorite={() => toggleFavorite(bar)}
    />
  );

  return (
    <View style={{ gap: spacing.md }}>
      {favorites.length > 0 && (
        <>
          <SectionTitle>Favoriten</SectionTitle>
          {favorites.map(row)}
        </>
      )}
      <SectionTitle>In der Nähe</SectionTitle>
      <LocationControls />
      {origin && !loading && nearby.length === 0 && (
        <EmptyState
          icon="search"
          title="Keine Shisha-Bar gefunden"
          text="Vergrössere den Suchradius oder ergänze eine fehlende Bar."
        />
      )}
      {nearby.map(row)}
      <Button title="Fehlende Bar ergänzen" icon="add-circle-outline" variant="ghost" onPress={() => router.push('/bar/new')} />
      {selected.length > 0 && (
        <Text style={[font.small, { textAlign: 'center' }]}>{selected.length} ausgewählt</Text>
      )}
    </View>
  );
}
