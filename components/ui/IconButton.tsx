import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { hitSlopFor, a11yState } from '@/lib/accessibility';
import { useSurfaceStyle } from './surface';

interface IconButtonProps {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  /** Required: what the button does, for screen readers (e.g. "Add task"). */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  /** 'primary' = white circle with a dark icon; 'plain' = glass/matte circle. */
  variant?: 'plain' | 'primary';
  /** Visual diameter. The touch target is always at least 44pt. */
  size?: number;
  iconSize?: number;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A round icon button (header actions, card actions). */
export default function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  variant = 'plain',
  size = 44,
  iconSize,
  disabled,
  selected,
  testID,
  style,
}: IconButtonProps) {
  const { theme } = useThemeStore();
  const surface = useSurfaceStyle();
  const primary = variant === 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      {...a11yState({ disabled: !!disabled, pressed: selected })}
      disabled={disabled}
      onPress={onPress}
      hitSlop={hitSlopFor(size)}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        primary ? { backgroundColor: theme.colors.primary } : surface,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <FontAwesome
        name={icon}
        size={iconSize ?? Math.round(size * 0.38)}
        color={primary ? theme.colors.onPrimary : theme.colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
