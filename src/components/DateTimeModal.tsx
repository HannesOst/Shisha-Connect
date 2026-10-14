import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '@/lib/theme';
import { Button } from './ui';

/** Cross-platform "date + time" picker: native dialogs on Android, a bottom sheet on iOS. */
export function DateTimeModal({
  visible,
  initial,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  initial: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return onCancel();
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type !== 'set' || !time) return onCancel();
            const result = new Date(date);
            result.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onConfirm(result);
          },
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (Platform.OS === 'android') return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      {visible && <IosSheet initial={initial} onConfirm={onConfirm} onCancel={onCancel} />}
    </Modal>
  );
}

function IosSheet({ initial, onConfirm, onCancel }: { initial: Date; onConfirm: (date: Date) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={font.h2}>Datum und Uhrzeit</Text>
        <DateTimePicker
          value={value}
          mode="datetime"
          display="inline"
          minimumDate={new Date()}
          minuteInterval={5}
          locale="de-CH"
          themeVariant="dark"
          accentColor={colors.accent}
          onChange={(_event, date) => date && setValue(date)}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Abbrechen" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          <Button title="Übernehmen" onPress={() => onConfirm(value)} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
});
