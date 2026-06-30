import { Tabs } from 'expo-router';
import { Gear, Heart, House, type Icon as PhosphorIcon } from 'phosphor-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SketchUnderline } from '@/components/SketchUnderline';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/useTranslation';
import { wavyLinePath } from '@/utils/sketch';

const ICONS: Record<string, PhosphorIcon> = {
  index: House,
  favorites: Heart,
  settings: Gear,
};

type TabItem = { key: string; name: string; title: string; focused: boolean };

function SketchTabBar({
  items,
  onPress,
}: {
  items: TabItem[];
  onPress: (item: TabItem) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.xs },
      ]}>
      <View style={styles.topLine} pointerEvents="none">
        <Svg width={width} height={6}>
          <Path
            d={wavyLinePath(width, 2)}
            stroke={colors.faintLine}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {items.map((item) => {
        const Icon = ICONS[item.name] ?? House;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(item)}
            style={styles.tab}
            hitSlop={8}>
            <Icon
              size={24}
              weight="thin"
              color={item.focused ? colors.accent : colors.textMuted}
            />
            <ThemedText variant="label" tone={item.focused ? 'accent' : 'textMuted'}>
              {item.title}
            </ThemedText>
            {item.focused && (
              <View style={styles.activeUnderline}>
                <SketchUnderline color={colors.accent} height={6} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const items: TabItem[] = props.state.routes.map((route, i) => {
          const title = props.descriptors[route.key]?.options.title;
          return {
            key: route.key,
            name: route.name,
            title: typeof title === 'string' ? title : route.name,
            focused: props.state.index === i,
          };
        });
        const onPress = (item: TabItem) => {
          const event = props.navigation.emit({
            type: 'tabPress',
            target: item.key,
            canPreventDefault: true,
          });
          if (!item.focused && !event.defaultPrevented) {
            props.navigation.navigate(item.name);
          }
        };
        return <SketchTabBar items={items} onPress={onPress} />;
      }}>
      <Tabs.Screen name="index" options={{ title: t('app.name') }} />
      <Tabs.Screen name="favorites" options={{ title: t('favorites.screenTitle') }} />
      <Tabs.Screen name="settings" options={{ title: t('settings.screenTitle') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingTop: Spacing.xs,
  },
  activeUnderline: {
    width: 36,
  },
});
