import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';
import type { RsvpStatus } from '@/lib/types';
import type { IconName } from './ui';

export const RSVP_META: Record<RsvpStatus, { label: string; icon: IconName; color: string; soft: string }> = {
  yes: { label: 'Dabei', icon: 'checkmark-circle', color: colors.yes, soft: colors.yesSoft },
  maybe: { label: 'Vielleicht', icon: 'help-circle', color: colors.maybe, soft: colors.maybeSoft },
  no: { label: 'Keine Zeit', icon: 'close-circle', color: colors.no, soft: colors.noSoft },
};

export function RsvpButtons({
  value,
  onChange,
  disabled,
}: {
  value: RsvpStatus | null;
  onChange: (status: RsvpStatus) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {(Object.keys(RSVP_META) as RsvpStatus[]).map((status) => {
        const meta = RSVP_META[status];
        const selected = value === status;
        return (
          <Pressable
            key={status}
            disabled={disabled}
            onPress={() => onChange(status)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.button,
              { borderColor: selected ? meta.color : colors.border },
              selected && { backgroundColor: meta.soft },
              pressed && { opacity: 0.7 },
              disabled && { opacity: 0.5 },
            ]}
          >
            <Ionicons name={meta.icon} size={26} color={selected ? meta.color : colors.textMuted} />
            <Text style={[styles.label, { color: selected ? meta.color : colors.text }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.glass,
    minHeight: 72,
  },
  label: { fontSize: 15, fontWeight: '700' },
});
