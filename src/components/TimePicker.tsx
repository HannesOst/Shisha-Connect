import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatWhen, quickTimes } from '@/lib/format';
import { colors, font, radius, spacing } from '@/lib/theme';
import { DateTimeModal } from './DateTimeModal';
import { Chip } from './ui';

/**
 * "Jetzt", "Heute Abend" or "Datum und Uhrzeit wählen".
 * In multi mode several times can be collected for a vote.
 */
export function TimePicker({ times, onChange, multi }: { times: Date[]; onChange: (times: Date[]) => void; multi: boolean }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const quick = quickTimes();

  const add = (date: Date) => {
    if (!multi) return onChange([date]);
    if (times.some((t) => Math.abs(t.getTime() - date.getTime()) < 60000)) return;
    onChange([...times, date].sort((a, b) => a.getTime() - b.getTime()).slice(0, 4));
  };
  const isSelected = (date: Date) => times.some((t) => Math.abs(t.getTime() - date.getTime()) < 60000);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.quickRow}>
        <QuickButton icon="flash" title="Jetzt" subtitle={`ab ${formatWhen(quick.now).split(', ')[1]}`} selected={isSelected(quick.now)} onPress={() => add(quick.now)} />
        <QuickButton icon="moon" title="Heute Abend" subtitle={formatWhen(quick.tonight).split(', ')[1]} selected={isSelected(quick.tonight)} onPress={() => add(quick.tonight)} />
      </View>
      <Chip icon="calendar" label="Datum und Uhrzeit wählen" onPress={() => setPickerOpen(true)} />
      {times.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text style={font.small}>{multi ? 'Vorgeschlagene Zeiten (max. 4)' : 'Gewählt'}</Text>
          {times.map((t) => (
            <View key={t.toISOString()} style={styles.selectedRow}>
              <Ionicons name="time" size={20} color={colors.accent} />
              <Text style={[font.body, { flex: 1, fontWeight: '700' }]}>{formatWhen(t)}</Text>
              <Pressable hitSlop={10} onPress={() => onChange(times.filter((x) => x !== t))} accessibilityLabel="Zeit entfernen">
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <DateTimeModal
        visible={pickerOpen}
        initial={times[times.length - 1] ?? quick.tonight}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(date) => {
          setPickerOpen(false);
          add(date);
        }}
      />
    </View>
  );
}

function QuickButton({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: 'flash' | 'moon';
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quick, selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
      <Ionicons name={icon} size={28} color={colors.accent} />
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={font.small}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', gap: spacing.md },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
