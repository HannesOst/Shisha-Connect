import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/lib/theme';

export function Hero() {
  return (
    <View style={styles.hero}>
      <View style={styles.glow}>
        <View style={styles.logo}>
          <Ionicons name="flame" size={44} color={colors.accent} />
        </View>
      </View>
      <Text style={font.title}>Shisha Connect</Text>
      <Text style={[font.muted, { textAlign: 'center' }]}>Gemeinsam zur Shisha – in wenigen Sekunden organisiert.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  glow: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
