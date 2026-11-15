import React from 'react';
import { View, StyleSheet, type ViewProps, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/stores/themeStore';
import GlassCard from '@/components/common/GlassCard';
import { MeshBackground, GrainOverlay } from '@/components/common/GlassBackground';
import { decorative } from '@/lib/accessibility';
import { useGlowCards } from '@/lib/glass';
import type { GlowName } from '@/themes';

/** A grainy soft-gradient fill (a "glow"), sized to its parent. */
export function GlowFill({ name, radius = 0 }: { name: GlowName; radius?: number }) {
  const { theme } = useThemeStore();
  return (
    <View
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      pointerEvents="none"
      {...decorative}
    >
      <MeshBackground preset={theme.glows[name]} scale={0.9} />
      {/* Keeps white text readable over the lighter parts of the gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.30)']}
        style={StyleSheet.absoluteFill}
      />
      <GrainOverlay level={1} />
    </View>
  );
}

interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'glow' = hero card: glass normally, a grainy gradient when the user picks solid surfaces. */
  variant?: 'surface' | 'glow';
  glow?: GlowName;
  radius?: number;
}

/** The app's card: glass, or (for hero cards with solid surfaces) a glow. */
export default function Card({
  children,
  style,
  variant = 'surface',
  glow = 'apricot',
  radius,
  ...rest
}: CardProps) {
  const { theme } = useThemeStore();
  const r = radius ?? theme.borderRadius.lg;
  const glowCards = useGlowCards();

  if (variant === 'glow' && glowCards) {
    return (
      <View style={[styles.glow, { borderRadius: r }, style]} {...rest}>
        <GlowFill name={glow} radius={r} />
        {children}
      </View>
    );
  }

  if (theme.isGlass) {
    return (
      <GlassCard radius={r} style={style} {...rest}>
        {children}
      </GlassCard>
    );
  }

  return (
    <View
      style={[
        styles.matte,
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
  matte: { overflow: 'hidden', borderWidth: 1 },
  glow: { overflow: 'hidden', boxShadow: '0 18px 40px -20px rgba(0,0,0,0.65)' },
});
