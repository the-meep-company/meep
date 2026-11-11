import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  type ViewProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/stores/themeStore';
import {
  useGlassPreset,
  webBackdrop,
  rimShadow,
  ensureLiquidGlassFilter,
  hasNativeGlass,
  useNativeGlass,
  type GlassPreset,
} from '@/lib/glass';
import { useSolidSurfaces, decorative } from '@/lib/accessibility';
import type { GlassStyle } from '@/types';

const isWeb = Platform.OS === 'web';

/**
 * Rounded frame for a glass surface: clips the layers and draws the edge highlight.
 * On iOS 26+ the system glass draws its own edge and shadow, so only the shape is set.
 */
export function glassFrame(preset: GlassPreset, radius: number): ViewStyle {
  if (hasNativeGlass()) return { borderRadius: radius };
  return {
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: preset.border,
    borderTopColor: preset.edge,
    borderLeftColor: preset.edge,
    boxShadow: '0 10px 28px -12px rgba(0,0,0,0.45)',
  };
}

/**
 * Apple's real Liquid Glass (iOS 26+), filling its parent. Renders nothing when
 * system glass is unavailable or surfaces should be solid, so callers can drop it in
 * unconditionally. Avoid opacity < 1 on its ancestors — UIGlassEffect stops rendering.
 */
export function NativeGlass({
  preset,
  radius = 0,
  style,
}: {
  preset: GlassPreset;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useThemeStore();
  if (!useNativeGlass()) return null;
  return (
    <GlassView
      glassEffectStyle={preset.nativeGlass}
      tintColor={preset.nativeTint}
      colorScheme={theme.appearance}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }, style]}
      pointerEvents="none"
      {...decorative}
    />
  );
}

/**
 * The stacked glass material. Render as the first children of a glassFrame view.
 * `radius` must match the frame's: on web, backdrop-filter ignores the parent's
 * rounded overflow clipping, so each layer carries its own corner radius.
 * With Reduce Transparency / Increase Contrast / Solid surfaces, this becomes one opaque fill.
 */
export function GlassLayers({ preset, radius = 0 }: { preset: GlassPreset; radius?: number }) {
  const { theme } = useThemeStore();
  const solid = useSolidSurfaces();
  const native = useNativeGlass();

  useEffect(() => {
    if (preset.refract && !solid) ensureLiquidGlassFilter();
  }, [preset.refract, solid]);

  const rounded = { borderRadius: Math.max(0, radius - 1) }; // inside the 1px frame border

  if (solid) {
    return (
      <View
        style={[StyleSheet.absoluteFill, rounded, { backgroundColor: theme.colors.surfaceOpaque }]}
        pointerEvents="none"
        {...decorative}
      />
    );
  }

  if (native) return <NativeGlass preset={preset} radius={radius} />;

  const backdrop = webBackdrop(preset);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" {...decorative}>
      {isWeb ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            rounded,
            {
              backgroundColor: preset.webVeil,
              backdropFilter: backdrop,
              WebkitBackdropFilter: backdrop,
            } as ViewStyle,
          ]}
        />
      ) : (
        <BlurView
          tint={preset.tint}
          intensity={preset.intensity}
          style={[StyleSheet.absoluteFill, rounded]}
        />
      )}
      <View style={[StyleSheet.absoluteFill, rounded, { backgroundColor: preset.fill }]} />
      <LinearGradient
        colors={preset.sheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.65 }}
        style={[StyleSheet.absoluteFill, rounded]}
      />
      {/* Rim light sits above the material but under the content */}
      <View style={[StyleSheet.absoluteFill, rounded, { boxShadow: rimShadow(preset.rim) }]} />
    </View>
  );
}

/** Real glass behind a plain row/chip/button styled with useSurfaceStyle (iOS 26+ only). */
export function SurfaceGlass({ radius }: { radius: number }) {
  return <NativeGlass preset={useGlassPreset()} radius={radius} />;
}

interface Props extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Force a specific glass style (e.g. for previews); defaults to the user's setting. */
  variant?: GlassStyle;
  radius?: number;
}

/**
 * A surface card. For glass themes it renders layered glass in the user's
 * chosen style; otherwise a solid themed surface.
 */
export default function GlassCard({ children, style, variant, radius, ...rest }: Props) {
  const { theme } = useThemeStore();
  const preset = useGlassPreset(variant);
  const r = radius ?? theme.borderRadius.lg;

  if (theme.isGlass) {
    return (
      <View style={[glassFrame(preset, r), style]} {...rest}>
        <GlassLayers preset={preset} radius={r} />
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.plain,
        { borderRadius: r, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { overflow: 'hidden', borderWidth: 1 },
});
