import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { useThemeStore } from '@/stores/themeStore';

interface Props {
  label: string;
  onPress: () => void;
  /** Spoken name when it should say more than the visible label. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHT = 44;

/**
 * The primary (white) pill button drawn in Apple's Liquid Glass, tinted with the
 * theme's primary colour (iOS 26+ only — gate with useNativeGlass()).
 * SwiftUI's .glassProminent would force a white label onto the white tint.
 */
export default function PrimaryGlassButton({
  label,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const { theme } = useThemeStore();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={4}
      // Scale, not opacity: system glass stops rendering under a translucent ancestor.
      style={({ pressed }) => [styles.button, { transform: [{ scale: pressed ? 0.95 : 1 }] }, style]}
    >
      <GlassView
        glassEffectStyle="regular"
        tintColor={theme.colors.primary}
        colorScheme={theme.appearance}
        style={[StyleSheet.absoluteFill, { borderRadius: HEIGHT / 2 }]}
        pointerEvents="none"
      />
      <Text style={[styles.label, { color: theme.colors.onPrimary }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: HEIGHT,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
});
