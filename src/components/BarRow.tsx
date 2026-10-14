import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatOpeningHours, navigationUrl } from '@/lib/bars';
import { formatDistance } from '@/lib/format';
import { colors, font, radius, spacing } from '@/lib/theme';
import type { BarCandidate } from '@/lib/types';
import { Badge } from './ui';

export function SourceBadge({ source }: { source: BarCandidate['source'] }) {
  if (source === 'sample') return <Badge label="BEISPIELDATEN" color={colors.maybe} />;
  if (source === 'manual') return <Badge label="Von der Gruppe ergänzt" color={colors.textMuted} />;
  return null;
}

export function BarRow({
  bar,
  favorite,
  onToggleFavorite,
  selected,
  onPress,
  showHours = true,
  highlighted,
}: {
  bar: BarCandidate;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  selected?: boolean;
  onPress?: () => void;
  showHours?: boolean;
  highlighted?: boolean;
}) {
  const distance = formatDistance(bar.distanceKm);
  const hours = showHours ? formatOpeningHours(bar.opening_hours) : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        (selected || highlighted) && { borderColor: colors.accent },
        selected && { backgroundColor: colors.accentSoft },
        pressed && onPress && { opacity: 0.8 },
      ]}
    >
      {selected !== undefined && (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={selected ? colors.accent : colors.textFaint}
        />
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={1}>
          {bar.name}
        </Text>
        {bar.address ? (
          <Text style={font.small} numberOfLines={1}>
            {bar.address}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          {distance && <Text style={[font.small, { color: colors.accent, fontWeight: '700' }]}>{distance}</Text>}
          <SourceBadge source={bar.source} />
        </View>
        {hours ? (
          <Text style={[font.small, { color: colors.textFaint }]} numberOfLines={3}>
            {hours}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onToggleFavorite && (
          <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityLabel={favorite ? 'Favorit entfernen' : 'Als Favorit speichern'}>
            <Ionicons name={favorite ? 'star' : 'star-outline'} size={24} color={favorite ? colors.amber : colors.textMuted} />
          </Pressable>
        )}
        {(bar.lat != null || bar.address) && bar.source !== 'sample' && (
          <Pressable onPress={() => Linking.openURL(navigationUrl(bar))} hitSlop={10} accessibilityLabel="Navigation starten">
            <Ionicons name="navigate-circle-outline" size={26} color={colors.accent} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  actions: { gap: spacing.md, alignItems: 'center' },
});
