import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useThemeStore } from '@/stores/themeStore';
import { a11yState } from '@/lib/accessibility';
import { usePageTitle, VISIBLE_TABS } from './FloatingTabBar';

export const SIDEBAR_WIDTH = 220;

/**
 * Desktop web navigation: a left sidebar in place of the floating pill,
 * so wide windows don't leave a phone-sized bar floating over the content.
 */
export default function WebSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useThemeStore();
  usePageTitle({ state, descriptors });

  const routes = state.routes.filter((r) => VISIBLE_TABS.includes(r.name));
  const focusedName = state.routes[state.index]?.name;

  return (
    <View
      role="navigation"
      style={[
        styles.bar,
        { backgroundColor: theme.colors.surfaceOpaque, borderRightColor: theme.colors.border },
      ]}
    >
      <Text style={[styles.brand, { color: theme.colors.text }]}>meep</Text>
      <View accessibilityRole="tablist" style={styles.list}>
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.name === focusedName;
          const color = focused ? theme.colors.tabBarActive : theme.colors.textSecondary;
          const label = typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              {...a11yState({ selected: focused })}
              accessibilityLabel={label}
              onPress={onPress}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.item,
                (focused || hovered) && {
                  backgroundColor: focused ? theme.colors.primaryLight : theme.colors.surfaceSecondary,
                },
              ]}
            >
              <View style={styles.icon}>{options.tabBarIcon?.({ focused, color, size: 18 })}</View>
              <Text style={[styles.label, { color, fontWeight: focused ? '600' : '500' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    paddingHorizontal: 12,
    paddingTop: 24,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  list: {
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  icon: {
    width: 20,
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
  },
});
