import type { ThemeDefinition } from './types';
import { borderRadius, glows, spacing, typography } from './shared';

// Afterglow — matte and grainy. A warm near-black base with soft light bleeding
// in at the edges, solid cards, and grainy gradient "glow" cards for the hero
// moments. Less glass, more film.
export const afterglow: ThemeDefinition = {
  name: 'afterglow',
  label: 'Afterglow',
  description: 'Matte and grainy, with soft gradient glows',
  appearance: 'dark',
  isGlass: false,
  gradient: ['#1B1719', '#0B0A0C'],
  backdrop: {
    base: ['#1B1719', '#0B0A0C'],
    blobs: [
      { color: '#E9875E', size: 1.0, left: -0.45, top: -0.3, opacity: 0.16 },
      { color: '#4C8C94', size: 0.9, left: 0.5, top: 0.72, opacity: 0.12 },
    ],
    light: false,
  },
  glows,
  colors: {
    background: '#0D0C0E',
    surface: '#1A181B',
    surfaceSecondary: '#242126',
    surfaceOpaque: '#1A181B',
    text: '#F4EFEA',
    textSecondary: 'rgba(244,239,234,0.70)',
    textTertiary: 'rgba(244,239,234,0.54)',
    primary: '#F4EFEA',
    onPrimary: '#141215',
    primaryLight: 'rgba(244,239,234,0.12)',
    accent: '#F2A07B',
    border: 'rgba(255,255,255,0.08)',
    borderLight: 'rgba(255,255,255,0.04)',
    success: '#9BE07A',
    warning: '#F5C451',
    error: '#FF8A80',
    tabBarActive: '#F4EFEA',
  },
  spacing,
  borderRadius,
  typography,
};
