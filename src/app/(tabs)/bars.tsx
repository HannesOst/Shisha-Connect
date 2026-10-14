import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { BarMap } from '@/components/BarMap';
import { BarRow } from '@/components/BarRow';
import { LocationControls } from '@/components/LocationControls';
import { Button, Card, Chip, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { colors, font, spacing } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';
import { useBarSearch } from '@/providers/BarSearchProvider';

export default function BarsScreen() {
  const { results, favorites, origin, radiusKm, loading, refresh, isFavorite, toggleFavorite } = useBarSearch();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const active = [...favorites, ...results].find((b) => b.key === activeKey) ?? null;
  const favoriteKeys = new Set(favorites.map((f) => f.key));

  const row = (bar: BarCandidate) => (
    <BarRow
      key={bar.key}
      bar={bar}
      favorite={isFavorite(bar)}
      onToggleFavorite={() => toggleFavorite(bar)}
      highlighted={bar.key === activeKey}
      onPress={() => setActiveKey(bar.key === activeKey ? null : bar.key)}
    />
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={font.title}>Bars</Text>
      <LocationControls />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip icon="list" label="Liste" selected={view === 'list'} onPress={() => setView('list')} />
        <Chip icon="map" label="Karte" selected={view === 'map'} onPress={() => setView('map')} />
      </View>

      {view === 'map' && (
        <BarMap bars={[...results, ...favorites.filter((f) => !results.some((r) => r.key === f.key))]} origin={origin} radiusKm={radiusKm} activeKey={activeKey} onSelect={setActiveKey} height={360} />
      )}

      {active && (
        <Card style={{ borderColor: colors.accent }}>
          <BarRow bar={active} favorite={isFavorite(active)} onToggleFavorite={() => toggleFavorite(active)} />
          <Button
            title="Treffen hier planen"
            icon="flame"
            onPress={() => router.push({ pathname: '/meetup/new', params: { barKey: active.key } })}
          />
        </Card>
      )}

      {favorites.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>Favoriten</SectionTitle>
          {favorites.map(row)}
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <SectionTitle right={<Text style={font.small}>Daten: OpenStreetMap</Text>}>In der Nähe</SectionTitle>
        {origin && !loading && results.length === 0 && (
          <EmptyState icon="search" title="Keine Shisha-Bar gefunden" text="Vergrössere den Radius oder ergänze die Bar selbst." />
        )}
        {results.filter((b) => !favoriteKeys.has(b.key)).map(row)}
      </View>

      <Button title="Fehlende Bar ergänzen" icon="add-circle-outline" variant="secondary" onPress={() => router.push('/bar/new')} />
    </Screen>
  );
}
