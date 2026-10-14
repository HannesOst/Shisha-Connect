import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { initials } from '@/lib/format';
import { colors, font, radius, spacing } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  refreshControl,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const textColor =
    variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.no : variant === 'ghost' ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        variant === 'primary' && { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        variant === 'secondary' && { backgroundColor: pressed ? colors.border : colors.surfaceAlt },
        variant === 'ghost' && { backgroundColor: pressed ? colors.accentSoft : 'transparent' },
        variant === 'danger' && { backgroundColor: pressed ? colors.noSoft : 'transparent', borderWidth: 1, borderColor: colors.no },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 18 : 22} color={textColor} />}
          <Text style={[styles.buttonText, small && { fontSize: 15 }, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceAlt }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({ name, url, size = 40 }: { name?: string | null; url?: string | null; size?: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon && <Ionicons name={icon} size={16} color={selected ? colors.onAccent : colors.text} />}
      <Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.textFaint} style={[styles.input, style]} {...props} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={font.h2}>{children}</Text>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textFaint} />
      <Text style={[font.h2, { textAlign: 'center' }]}>{title}</Text>
      {text && <Text style={[font.muted, { textAlign: 'center' }]}>{text}</Text>}
      {children}
    </View>
  );
}

export function Notice({ icon = 'information-circle', tone = 'info', children }: { icon?: IconName; tone?: 'info' | 'warning'; children: ReactNode }) {
  const color = tone === 'warning' ? colors.maybe : colors.accent;
  return (
    <View style={[styles.notice, { borderColor: color, backgroundColor: tone === 'warning' ? colors.maybeSoft : colors.accentSoft }]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1, gap: spacing.sm }}>{children}</View>
    </View>
  );
}

export function Badge({ label, color = colors.accent }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonSmall: { minHeight: 42, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  buttonText: { fontSize: 17, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  avatar: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    minHeight: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
