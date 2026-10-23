import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

interface DisplayTitleProps {
  /** Muted first line (e.g. "Your"). */
  lead?: string;
  /** Main line. */
  title: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Large, light-weight two-tone heading. Read by screen readers as a single
 * heading ("Your tasks"), not two fragments.
 */
export function DisplayTitle({ lead, title, style }: DisplayTitleProps) {
  const { theme } = useThemeStore();
  const display = theme.typography.display;
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={lead ? `${lead} ${title}` : title}
      style={style}
    >
      {lead ? <Text style={[display, { color: theme.colors.textSecondary }]}>{lead}</Text> : null}
      <Text style={[display, { color: theme.colors.text }]}>{title}</Text>
    </View>
  );
}

/** Small uppercase, letter-spaced section label. Marked as a heading for navigation. */
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { theme } = useThemeStore();
  return (
    <Text
      accessibilityRole="header"
      style={[theme.typography.overline, styles.overline, { color: theme.colors.textSecondary }, style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  overline: { textTransform: 'uppercase' },
});
