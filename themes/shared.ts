import type { GlowName, GlowPalette, ThemeDefinition } from './types';

// Layout + type scale shared by every theme: large light display type, roomy
// padding, and big soft corners.

export const spacing: ThemeDefinition['spacing'] = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  screen: 20, // horizontal screen padding
};

export const borderRadius: ThemeDefinition['borderRadius'] = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 36,
  full: 999,
};

export const typography: ThemeDefinition['typography'] = {
  display: { fontSize: 36, fontWeight: '300', letterSpacing: -0.8, lineHeight: 41 },
  title: { fontSize: 22, fontWeight: '400', letterSpacing: -0.3, lineHeight: 28 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, lineHeight: 14 },
};

// Grainy soft-gradient fills for hero "glow" cards. Blob geometry uses the same
// fractions as wallpapers (see lib/backgrounds.ts).
export const glows: Record<GlowName, GlowPalette> = {
  apricot: {
    base: ['#2A1A16', '#E58A55', '#F7DDBF'],
    blobs: [
      { color: '#1A100E', size: 0.9, left: -0.3, top: -0.35, opacity: 0.7 },
      { color: '#7FA9AE', size: 0.8, left: 0.55, top: -0.3, opacity: 0.55 },
      { color: '#E9875E', size: 0.8, left: -0.25, top: 0.25, opacity: 0.7 },
    ],
  },
  rose: {
    base: ['#C99A9A', '#3B2430'],
    blobs: [
      { color: '#E8B4B0', size: 1.0, left: 0.1, top: -0.45, opacity: 0.7 },
      { color: '#2E1A26', size: 0.9, left: -0.4, top: 0.45, opacity: 0.6 },
      { color: '#D9A08E', size: 0.7, left: 0.55, top: 0.3, opacity: 0.5 },
    ],
  },
  plum: {
    base: ['#4A3256', '#140F18'],
    blobs: [
      { color: '#8E6BB0', size: 0.9, left: 0.35, top: -0.35, opacity: 0.5 },
      { color: '#C97A9A', size: 0.7, left: -0.3, top: 0.4, opacity: 0.35 },
    ],
  },
  ocean: {
    base: ['#2A3E58', '#5DB3C4'],
    blobs: [
      { color: '#1B2740', size: 1.0, left: -0.2, top: -0.45, opacity: 0.75 },
      { color: '#9C7BA0', size: 0.7, left: 0.6, top: 0.05, opacity: 0.45 },
      { color: '#5FC6CF', size: 0.9, left: 0.0, top: 0.55, opacity: 0.6 },
    ],
  },
  sky: {
    base: ['#0E1726', '#4A86E0'],
    blobs: [
      { color: '#0A0F1A', size: 1.0, left: -0.3, top: -0.5, opacity: 0.8 },
      { color: '#5B95EA', size: 1.0, left: 0.1, top: 0.45, opacity: 0.7 },
      { color: '#CFE0F7', size: 0.5, left: 0.55, top: 0.1, opacity: 0.25 },
    ],
  },
  lime: {
    base: ['#4E5A44', '#B7D257'],
    blobs: [
      { color: '#2F382A', size: 0.9, left: -0.35, top: -0.4, opacity: 0.6 },
      { color: '#E4F2A8', size: 0.7, left: 0.5, top: 0.1, opacity: 0.45 },
      { color: '#C8EA5A', size: 0.8, left: 0.05, top: 0.55, opacity: 0.5 },
    ],
  },
};
