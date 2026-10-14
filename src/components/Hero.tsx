import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/lib/theme';

export function Hero() {
  return (
    <View style={styles.hero}>
      <Text style={styles.logo}>🔥</Text>
      <Text style={font.title}>Shisha Connect</Text>
      <Text style={[font.muted, { textAlign: 'center' }]}>Gemeinsam zur Shisha – in wenigen Sekunden organisiert.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  logo: { fontSize: 56, color: colors.accent },
});
