import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useThemeStore } from '@/stores/themeStore';
import { NAV_GLASS, rimShadow } from '@/lib/glass';
import { useReduceMotion, a11yState } from '@/lib/accessibility';
import { GlassLayers, glassFrame } from '@/components/common/GlassCard';

// Tabs shown in the bar; other routes in the navigator are hidden template screens.
const VISIBLE_TABS = ['calendar', 'tasks', 'chat', 'settings'];

export const TAB_BAR_HEIGHT = 64;
const PADDING = 5;
const RADIUS = TAB_BAR_HEIGHT / 2;

function useBottomOffset() {
  const insets = useSafeAreaInsets();
  return insets.bottom > 0 ? insets.bottom - 6 : 14;
}

/** Bottom space a screen should leave so its last item can scroll clear of the bar. */
export function useTabBarClearance() {
  return useBottomOffset() + TAB_BAR_HEIGHT + 16;
}

/**
 * A floating pill tab bar. Liquid Glass on the glass theme, matte on Afterglow.
 * A brighter "lens" springs to the active tab (or jumps, with Reduce Motion).
 */
export default function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useThemeStore();
  const bottom = useBottomOffset();
  const reduceMotion = useReduceMotion();
  const tone = theme.appearance;
  const glass = NAV_GLASS[tone];

  const routes = state.routes.filter((r) => VISIBLE_TABS.includes(r.name));
  const focusedName = state.routes[state.index]?.name;
  const activeIndex = Math.max(0, routes.findIndex((r) => r.name === focusedName));

  const [barWidth, setBarWidth] = useState(0);
  const itemWidth = barWidth > 0 ? (barWidth - PADDING * 2) / routes.length : 0;
  const lensX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!itemWidth) return;
    const to = activeIndex * itemWidth;
    if (!placed.current || reduceMotion) {
      lensX.setValue(to); // first layout, or Reduce Motion: no slide
      placed.current = true;
      return;
    }
    Animated.spring(lensX, {
      toValue: to,
      damping: 18,
      stiffness: 190,
      mass: 0.9,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeIndex, itemWidth, lensX, reduceMotion]);

  // Web: name the page after the active tab so screen readers announce where you are.
  const focusedOptions = state.routes[state.index]
    ? descriptors[state.routes[state.index].key]?.options
    : undefined;
  const pageTitle = typeof focusedOptions?.title === 'string' ? focusedOptions.title : null;
  useEffect(() => {
    if (Platform.OS === 'web' && pageTitle) {
      document.title = pageTitle === 'Meep' ? 'Meep' : `${pageTitle} – Meep`;
    }
  }, [pageTitle]);

  const inactive = tone === 'dark' ? 'rgba(255,255,255,0.74)' : 'rgba(0,0,0,0.6)';
  const active = theme.colors.tabBarActive;

  return (
    <View role="navigation" pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View
        accessibilityRole="tablist"
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={[
          styles.bar,
          theme.isGlass
            ? glassFrame(glass, RADIUS)
            : {
                borderRadius: RADIUS,
                backgroundColor: theme.colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: theme.colors.border,
                boxShadow: '0 16px 36px -14px rgba(0,0,0,0.7)',
              },
        ]}
      >
        {theme.isGlass && <GlassLayers preset={glass} radius={RADIUS} />}

        {itemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lens,
              {
                width: itemWidth,
                backgroundColor: theme.isGlass ? 'rgba(255,255,255,0.16)' : theme.colors.primaryLight,
                boxShadow: rimShadow(theme.isGlass ? 0.3 : 0.08),
                transform: [{ translateX: lensX }],
              },
            ]}
          />
        )}

        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.name === focusedName;
          const color = focused ? active : inactive;
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
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
            >
              {options.tabBarIcon?.({ focused, color, size: 20 })}
              {/* Capped: the pill has a fixed height; selection is also announced */}
              <Text
                style={[styles.label, { color, fontWeight: focused ? '600' : '500' }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
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
  wrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 440,
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    padding: PADDING,
  },
  lens: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: RADIUS - PADDING,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
});
