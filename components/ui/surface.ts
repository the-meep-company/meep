import { Platform, type ViewStyle } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useSolidSurfaces } from '@/lib/accessibility';
import { rimShadow } from '@/lib/glass';

/**
 * Background/border style for ordinary rows, chips and buttons built from a
 * plain View/Pressable (for big hero surfaces use <Card>/<GlassCard>).
 *  - Glass, web: real frosted glass via backdrop-filter.
 *  - Glass, native: a tinted translucent fill (a BlurView can't be a style).
 *  - Solid surfaces (Reduce Transparency / Increase Contrast / in-app): opaque.
 *  - Afterglow: matte.
 */
export function useSurfaceStyle(emphasis: 'default' | 'strong' = 'default'): ViewStyle {
  const { theme } = useThemeStore();
  const solid = useSolidSurfaces();

  if (solid) {
    return { backgroundColor: theme.colors.surfaceOpaque, borderWidth: 1, borderColor: theme.colors.border };
  }

  if (!theme.isGlass) {
    return {
      backgroundColor: emphasis === 'strong' ? theme.colors.surfaceSecondary : theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    };
  }

  if (Platform.OS === 'web') {
    const backdrop = `blur(${emphasis === 'strong' ? 18 : 14}px) saturate(1.6)`;
    return {
      backgroundColor: emphasis === 'strong' ? 'rgba(28,28,34,0.34)' : 'rgba(28,28,34,0.24)',
      backdropFilter: backdrop,
      WebkitBackdropFilter: backdrop,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      borderTopColor: 'rgba(255,255,255,0.32)',
      boxShadow: rimShadow(0.12),
    } as ViewStyle;
  }

  return {
    backgroundColor: emphasis === 'strong' ? 'rgba(24,32,54,0.78)' : 'rgba(24,32,54,0.64)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  };
}
