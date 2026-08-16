import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { WobblyBorder } from '@/components/WobblyBorder';
import { Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** 'quote' = kullanıcının kendi kelimesi (Caveat, el yazısı hissi). */
  variant?: 'body' | 'quote';
  autoFocus?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  /** Zorunlu — anonim input yasak. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Defter çizgisinde tek satırlık metin girişi (auth.tsx'teki WobblyBorder + TextInput
 * deseninin bileşenleşmiş hali). Focus, renkten bağımsız da okunabilsin diye yalnızca
 * renkle değil çift çizgi + kalınlıkla anlatılır (ThemeChips'in seçili-durum deseni).
 */
export function SketchTextInput({
  value,
  onChangeText,
  placeholder,
  maxLength,
  variant = 'body',
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      <WobblyBorder
        stroke={focused ? colors.accent : colors.faintLine}
        strokeWidth={focused ? 1.6 : 1.4}
        doubleStroke={focused}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        maxLength={maxLength}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        // Placeholder'lar bilinçli küçük harf (defter kenarı notu tonu) — otomatik
        // büyütme/düzeltme bu tonu bozar.
        autoCapitalize="none"
        autoCorrect={false}
        cursorColor={colors.accent}
        selectionColor={colors.accent}
        // accessibilityRole verilmedi: native edit-field rolü zaten anons ediliyor,
        // role eklemek Android'de çift anons yaratabiliyor.
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[
          styles.input,
          variant === 'quote' ? styles.quoteText : styles.bodyText,
          { color: colors.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 48, // dokunma hedefi güvencesi
  },
  // Boyutlar UX spec'inden: body 16pt (auth paritesi), quote 22pt (Caveat, tek
  // satırlık girdi için FontSizes.quote fazla iri).
  bodyText: {
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  quoteText: {
    fontFamily: Fonts.quote,
    fontSize: 22,
  },
});
