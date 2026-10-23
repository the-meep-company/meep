import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { GlowFill } from './Card';
import { decorative } from '@/lib/accessibility';
import type { GlowName } from '@/themes';

interface ScreenHeaderProps {
  /** Small centered title, e.g. "Calendar". Marked as a heading. */
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

/** Top bar: avatar or back on the left, centered title, round actions on the right. */
export default function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingTop: Math.max(insets.top, 16) + 8, paddingHorizontal: theme.spacing.screen },
      ]}
    >
      <View style={[styles.side, styles.left]}>{left}</View>
      {title ? (
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

/** Round avatar with a grainy glow and an initial — the companion's identity. */
export function GlowAvatar({ initial, glow = 'sky', size = 44 }: { initial: string; glow?: GlowName; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
      {...decorative}
    >
      <GlowFill name={glow} radius={size / 2} />
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.4, fontWeight: '500' }}>
        {initial.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    minHeight: 44,
  },
  side: { minWidth: 44, flexDirection: 'row', gap: 8, alignItems: 'center' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '500' },
  spacer: { flex: 1 },
});
