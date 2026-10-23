import type { GlassBackgroundId } from '@/types';

// Mesh-gradient wallpapers for the Liquid Glass theme. Each is a base gradient
// plus soft color blobs. Blob geometry is in fractions of the container so one
// definition renders both full-screen and as a small swatch:
//   size = diameter as a fraction of container width
//   left/top = top-left corner as a fraction of container width/height

export interface MeshBlob {
  color: string;
  size: number;
  left: number;
  top: number;
  opacity: number;
}

export interface BackgroundPreset {
  id: GlassBackgroundId;
  name: string;
  base: readonly [string, string, ...string[]];
  blobs: MeshBlob[];
  /** Black overlay (0-1) so white text stays readable on light wallpapers. */
  scrim: number;
  /** Light wallpapers soften blobs with a light veil on native instead of a dark one. */
  light: boolean;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    base: ['#1B3C70', '#0A1024'],
    blobs: [
      { color: '#5B9CFF', size: 0.85, left: 0.45, top: -0.12, opacity: 0.55 },
      { color: '#8B5CF6', size: 0.75, left: -0.35, top: 0.3, opacity: 0.45 },
      { color: '#22D3EE', size: 0.7, left: 0.55, top: 0.62, opacity: 0.32 },
      { color: '#F59E0B', size: 0.6, left: 0.05, top: 0.85, opacity: 0.22 },
    ],
    scrim: 0,
    light: false,
  },
  {
    id: 'meadow',
    name: 'Meadow',
    base: ['#86B9D6', '#9CC7D8', '#2E6B2A'],
    blobs: [
      { color: '#C4E3F0', size: 0.95, left: 0.15, top: -0.22, opacity: 0.7 },
      { color: '#5E9E3E', size: 1.15, left: -0.35, top: 0.42, opacity: 0.85 },
      { color: '#8CC063', size: 0.75, left: 0.45, top: 0.36, opacity: 0.6 },
      { color: '#1E4F1C', size: 1.0, left: 0.35, top: 0.7, opacity: 0.75 },
    ],
    scrim: 0.34,
    light: true,
  },
  {
    id: 'sky',
    name: 'Sky',
    base: ['#2F6FC9', '#9CC4EE'],
    blobs: [
      { color: '#6FA5E8', size: 0.85, left: 0.3, top: -0.12, opacity: 0.6 },
      { color: '#FFFFFF', size: 0.9, left: -0.25, top: 0.35, opacity: 0.5 },
      { color: '#DCEBFA', size: 0.65, left: 0.55, top: 0.25, opacity: 0.45 },
      { color: '#FFFFFF', size: 0.8, left: 0.45, top: 0.62, opacity: 0.45 },
    ],
    scrim: 0.34,
    light: true,
  },
  {
    id: 'dusk',
    name: 'Dusk',
    base: ['#B8A3BC', '#8C7A72'],
    blobs: [
      { color: '#F1C6D3', size: 0.8, left: 0.4, top: -0.1, opacity: 0.6 },
      { color: '#A795C2', size: 0.8, left: -0.3, top: 0.15, opacity: 0.5 },
      { color: '#FFD9E6', size: 0.5, left: 0.55, top: 0.5, opacity: 0.45 },
      { color: '#CDB49A', size: 1.0, left: -0.1, top: 0.62, opacity: 0.6 },
    ],
    scrim: 0.36,
    light: true,
  },
  {
    id: 'rose',
    name: 'Rose',
    base: ['#E9A3AE', '#B65E6C'],
    blobs: [
      { color: '#F7CBCB', size: 0.9, left: 0.3, top: -0.2, opacity: 0.6 },
      { color: '#FFE1E6', size: 0.45, left: 0.1, top: 0.25, opacity: 0.45 },
      { color: '#D4707F', size: 0.8, left: -0.3, top: 0.5, opacity: 0.55 },
      { color: '#F2B39C', size: 0.7, left: 0.5, top: 0.7, opacity: 0.5 },
    ],
    scrim: 0.34,
    light: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    base: ['#9A8E83', '#4E463F'],
    blobs: [
      { color: '#C8BDB1', size: 0.9, left: 0.35, top: -0.15, opacity: 0.55 },
      { color: '#E2D8CC', size: 0.5, left: 0.55, top: 0.45, opacity: 0.35 },
      { color: '#7A6F65', size: 0.9, left: -0.35, top: 0.5, opacity: 0.5 },
      { color: '#5C524A', size: 0.8, left: 0.3, top: 0.8, opacity: 0.5 },
    ],
    scrim: 0.12,
    light: false,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    base: ['#0B1F2A', '#050E14'],
    blobs: [
      { color: '#34D399', size: 0.8, left: -0.2, top: 0.05, opacity: 0.5 },
      { color: '#22D3EE', size: 0.75, left: 0.5, top: 0.3, opacity: 0.45 },
      { color: '#A78BFA', size: 0.8, left: -0.1, top: 0.62, opacity: 0.45 },
      { color: '#2DD4BF', size: 0.5, left: 0.55, top: 0.8, opacity: 0.3 },
    ],
    scrim: 0,
    light: false,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    base: ['#F97316', '#7C2D12'],
    blobs: [
      { color: '#FDBA74', size: 0.9, left: 0.3, top: -0.2, opacity: 0.6 },
      { color: '#FB7185', size: 0.8, left: -0.35, top: 0.4, opacity: 0.55 },
      { color: '#FDE68A', size: 0.5, left: 0.55, top: 0.45, opacity: 0.5 },
      { color: '#9A3412', size: 0.9, left: 0.2, top: 0.75, opacity: 0.6 },
    ],
    scrim: 0.1,
    light: false,
  },
  {
    // Red-orange light from the top-left, through deep teal, into near-black.
    id: 'ember',
    name: 'Ember',
    base: ['#3A160C', '#123230', '#0B0F12'],
    blobs: [
      { color: '#FF8A2E', size: 0.8, left: 0.15, top: -0.3, opacity: 0.95 },
      { color: '#E8441A', size: 1.0, left: -0.5, top: -0.1, opacity: 0.95 },
      { color: '#1F5E5A', size: 1.15, left: 0.15, top: 0.28, opacity: 0.7 },
      { color: '#0A0D10', size: 1.3, left: -0.25, top: 0.68, opacity: 0.85 },
    ],
    scrim: 0,
    light: false,
  },
];

export const DEFAULT_BACKGROUND: GlassBackgroundId = 'midnight';

export function getBackgroundPreset(id: GlassBackgroundId | 'custom'): BackgroundPreset {
  return BACKGROUND_PRESETS.find((p) => p.id === id) ?? BACKGROUND_PRESETS[0];
}

/** Scrim over a user's own photo — photos vary, so keep text readable by default. */
export const CUSTOM_PHOTO_SCRIM = 0.18;
