import { CaretDown, CaretUp } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SketchButton } from '@/components/SketchButton';
import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { WobblyBorder } from '@/components/WobblyBorder';
import { Fonts, FontSizes } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { formatHM } from '@/utils/timeUtils';

const MINUTE_STEP = 15;

type Props = {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
};

export function TimePicker({ hour, minute, onChange }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  const openModal = () => {
    setH(hour);
    setM(minute);
    setOpen(true);
  };

  const confirm = () => {
    onChange(h, m);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={openModal} style={styles.display} hitSlop={6}>
        <ThemedText style={[styles.time, { color: colors.text }]}>{formatHM(hour, minute)}</ThemedText>
        <View style={styles.underline}>
          <SketchUnderline />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <WobblyBorder stroke={colors.accent} strokeWidth={1.5} inset={6} />

            <View style={styles.steppers}>
              <Stepper
                value={h}
                color={colors.text}
                accent={colors.accent}
                onUp={() => setH((v) => (v + 1) % 24)}
                onDown={() => setH((v) => (v + 23) % 24)}
                format={(v) => String(v).padStart(2, '0')}
              />
              <ThemedText style={[styles.colon, { color: colors.textMuted }]}>:</ThemedText>
              <Stepper
                value={m}
                color={colors.text}
                accent={colors.accent}
                onUp={() => setM((v) => (v + MINUTE_STEP) % 60)}
                onDown={() => setM((v) => (v + 60 - MINUTE_STEP) % 60)}
                format={(v) => String(v).padStart(2, '0')}
              />
            </View>

            <SketchButton label={t('common.save')} onPress={confirm} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Stepper({
  value,
  color,
  accent,
  onUp,
  onDown,
  format,
}: {
  value: number;
  color: string;
  accent: string;
  onUp: () => void;
  onDown: () => void;
  format: (v: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onUp} hitSlop={10}>
        <CaretUp size={28} weight="thin" color={accent} />
      </Pressable>
      <ThemedText style={[styles.stepperValue, { color }]}>{format(value)}</ThemedText>
      <Pressable onPress={onDown} hitSlop={10}>
        <CaretDown size={28} weight="thin" color={accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  display: {
    alignItems: 'center',
  },
  time: {
    fontFamily: Fonts.quote,
    fontSize: FontSizes.quoteLarge,
  },
  underline: {
    width: 70,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: 280,
    padding: Spacing.xl,
    gap: Spacing.xl,
    alignItems: 'center',
  },
  steppers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  stepper: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepperValue: {
    fontFamily: Fonts.quote,
    fontSize: 40,
  },
  colon: {
    fontFamily: Fonts.quote,
    fontSize: 40,
  },
});
