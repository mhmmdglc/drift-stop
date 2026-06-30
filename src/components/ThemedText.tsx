import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontSizes } from '@/constants/fonts';
import type { ColorKey } from '@/constants/colors';
import { useTheme } from '@/hooks/use-theme';

type Variant =
  | 'quote'
  | 'quoteLarge'
  | 'author'
  | 'label'
  | 'title'
  | 'heading'
  | 'body';

type Props = TextProps & {
  variant?: Variant;
  tone?: ColorKey;
};

const VARIANT_STYLE: Record<Variant, { fontFamily: string; fontSize: number; lineHeight?: number }> = {
  quote: { fontFamily: Fonts.quote, fontSize: FontSizes.quote, lineHeight: FontSizes.quote * 1.4 },
  quoteLarge: {
    fontFamily: Fonts.quote,
    fontSize: FontSizes.quoteLarge,
    lineHeight: FontSizes.quoteLarge * 1.4,
  },
  author: { fontFamily: Fonts.body, fontSize: FontSizes.author },
  label: { fontFamily: Fonts.body, fontSize: FontSizes.label },
  title: { fontFamily: Fonts.display, fontSize: FontSizes.title },
  heading: { fontFamily: Fonts.display, fontSize: FontSizes.heading },
  body: { fontFamily: Fonts.body, fontSize: FontSizes.body },
};

const DEFAULT_TONE: Record<Variant, ColorKey> = {
  quote: 'text',
  quoteLarge: 'text',
  author: 'textMuted',
  label: 'textMuted',
  title: 'text',
  heading: 'text',
  body: 'text',
};

export function ThemedText({ variant = 'body', tone, style, ...rest }: Props) {
  const { colors } = useTheme();
  const v = VARIANT_STYLE[variant];
  const color = colors[tone ?? DEFAULT_TONE[variant]];
  return <Text style={[styles.base, v, { color }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0.5,
  },
});
