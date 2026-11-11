import React from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type * as SwiftUI from '@expo/ui/swift-ui';
import type * as SwiftUIModifiers from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useThemeStore } from '@/stores/themeStore';
import { hitSlopFor, a11yState } from '@/lib/accessibility';
import { useSurfaceStyle } from './surface';
import { useNativeGlass } from '@/lib/glass';
import { SurfaceGlass } from '@/components/common/GlassCard';

type FAName = React.ComponentProps<typeof FontAwesome>['name'];

// SwiftUI views exist only on iOS; importing the module on web or Android throws at load.
const swiftUI: typeof SwiftUI | null = Platform.OS === 'ios' ? require('@expo/ui/swift-ui') : null;
const swiftMods: typeof SwiftUIModifiers | null =
  Platform.OS === 'ios' ? require('@expo/ui/swift-ui/modifiers') : null;

// SF Symbol equivalents for the native (SwiftUI) glass button. Icons not listed
// here fall back to the React Native button.
const SF_SYMBOLS: Partial<Record<FAName, SFSymbol>> = {
  plus: 'plus',
  times: 'xmark',
  magic: 'wand.and.sparkles',
  'chevron-left': 'chevron.left',
  'chevron-right': 'chevron.right',
  'calendar-check-o': 'calendar.badge.checkmark',
  'volume-up': 'speaker.wave.2.fill',
  refresh: 'arrow.clockwise',
  pencil: 'pencil',
};

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
  // System glass stops rendering under a translucent ancestor, so press feedback scales instead.
  const nativeGlass = useNativeGlass();
  const glass = nativeGlass && !primary;
  const sf = SF_SYMBOLS[icon];
  const glyph = iconSize ?? Math.round(size * 0.38);

  // iOS 26+: a SwiftUI view with Apple's interactive Liquid Glass — it flexes and
  // shimmers under your finger like system buttons. Primary = white-tinted glass.
  if (nativeGlass && sf && swiftUI && swiftMods) {
    const { Host, Image } = swiftUI;
    const { accessibilityHint: a11yHint, accessibilityLabel: a11yLabel, disabled: swiftDisabled, frame, glassEffect } =
      swiftMods;
    return (
      <View testID={testID} style={[{ width: size, height: size }, style]}>
        <Host style={{ width: size, height: size }} colorScheme={theme.appearance}>
          <Image
            systemName={sf}
            size={glyph}
            color={primary ? theme.colors.onPrimary : theme.colors.text}
            onPress={disabled ? undefined : onPress}
            modifiers={[
              frame({ width: size, height: size }),
              glassEffect({
                glass: {
                  variant: 'regular',
                  interactive: !disabled,
                  tint: primary ? theme.colors.primary : undefined,
                },
                shape: 'circle',
              }),
              swiftDisabled(!!disabled),
              a11yLabel(accessibilityLabel),
              ...(accessibilityHint ? [a11yHint(accessibilityHint)] : []),
            ]}
          />
        </Host>
      </View>
    );
  }

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
        glass
          ? { opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }
          : { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {!primary && <SurfaceGlass radius={size / 2} />}
      <FontAwesome
        name={icon}
        size={glyph}
        color={primary ? theme.colors.onPrimary : theme.colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
