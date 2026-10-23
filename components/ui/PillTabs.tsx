import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useSurfaceStyle } from './surface';

import { a11yState } from '@/lib/accessibility';
export interface PillOption<T extends string> {
  value: T;
  label: string;
  /** Optional count shown in a small badge (and read out by screen readers). */
  count?: number;
}

interface PillTabsProps<T extends string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Task filter". */
  accessibilityLabel: string;
  /** 'fill' stretches pills to share the row equally (segmented control). */
  layout?: 'hug' | 'fill';
  /** 'tabs' switches views (tablist/tab); 'radio' picks a setting (radiogroup/radio). */
  semantics?: 'tabs' | 'radio';
  style?: StyleProp<ViewStyle>;
}

const PILL_HEIGHT = 38;

/** Pill-shaped tabs / segmented control. The selected pill is solid white. */
export default function PillTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  layout = 'hug',
  semantics = 'tabs',
  style,
}: PillTabsProps<T>) {
  const radio = semantics === 'radio';
  const { theme } = useThemeStore();
  const surface = useSurfaceStyle();

  return (
    <View
      accessibilityRole={radio ? 'radiogroup' : 'tablist'}
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, style]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const label =
          option.count != null ? `${option.label}, ${option.count}` : option.label;
        return (
          <Pressable
            key={option.value}
            testID={`pill-${option.value}`}
            accessibilityRole={radio ? 'radio' : 'tab'}
            accessibilityLabel={label}
            {...a11yState(radio ? { checked: selected } : { selected })}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 3, bottom: 3 }}
            style={({ pressed }) => [
              styles.pill,
              layout === 'fill' && styles.fill,
              selected
                ? { backgroundColor: theme.colors.primary, borderWidth: 1, borderColor: theme.colors.primary }
                : surface,
              pressed && !selected && { opacity: 0.7 },
            ]}
          >
            {option.count != null && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: selected ? 'rgba(0,0,0,0.08)' : theme.colors.primaryLight },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: selected ? theme.colors.onPrimary : theme.colors.text },
                  ]}
                  maxFontSizeMultiplier={1.4}
                >
                  {option.count}
                </Text>
              </View>
            )}
            <Text
              style={[
                styles.label,
                { color: selected ? theme.colors.onPrimary : theme.colors.textSecondary },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    minHeight: PILL_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: PILL_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  fill: { flex: 1, paddingHorizontal: 8 },
  label: { fontSize: 14, fontWeight: '500' },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
