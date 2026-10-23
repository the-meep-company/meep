import type { ThemeDefinition } from './types';
import { borderRadius, glows, spacing, typography } from './shared';

// Liquid Glass — frosted, translucent surfaces over a wallpaper the user picks
// (see components/common/GlassBackground + GlassCard). Monochrome UI: white
// pills for primary actions, color lives in the wallpaper.
export const glass: ThemeDefinition = {
  name: 'glass',
  label: 'Liquid Glass',
  description: 'Frosted glass over your choice of wallpaper',
  appearance: 'dark',
  isGlass: true,
  gradient: ['#1B3C70', '#0A1024'],
  backdrop: null, // glass uses the wallpaper picker instead
  glows,
  colors: {
    background: '#0C1530', // flat fallback behind the wallpaper
    surface: 'rgba(255,255,255,0.07)',
    surfaceSecondary: 'rgba(255,255,255,0.12)',
    surfaceOpaque: '#1E2740',
    text: '#FFFFFF',
    // Neutral white "vibrancy" so text reads on any wallpaper, light or dark.
    textSecondary: 'rgba(255,255,255,0.80)',
    textTertiary: 'rgba(255,255,255,0.62)',
    primary: '#FFFFFF',
    onPrimary: '#0B1020',
    primaryLight: 'rgba(255,255,255,0.18)',
    accent: '#A9CBFF',
    border: 'rgba(255,255,255,0.14)',
    borderLight: 'rgba(255,255,255,0.07)',
    success: '#6EE7A0',
    warning: '#FACC15',
    error: '#FF8A8A',
    tabBarActive: '#FFFFFF',
  },
  spacing,
  borderRadius,
  typography,
};
