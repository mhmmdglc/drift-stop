import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';

type Props = {
  origin: string;
  originEmoji: string;
};

/** Köken: bayrak/sembol emoji + ülke adı, soluk. */
export function OriginBadge({ origin, originEmoji }: Props) {
  return (
    <View style={styles.row}>
      <ThemedText variant="label">{originEmoji}</ThemedText>
      <ThemedText variant="label" tone="textMuted">
        {origin}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
