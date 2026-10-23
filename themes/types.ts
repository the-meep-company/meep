import type { MeshBlob } from '@/lib/backgrounds';

/** Named gradient palettes for "glow" hero cards (grainy soft-gradient fills). */
export type GlowName = 'apricot' | 'rose' | 'plum' | 'ocean' | 'sky' | 'lime';

export interface GlowPalette {
  base: readonly [string, string, ...string[]];
  blobs: MeshBlob[];
}

/** Ambient full-screen backdrop for non-glass themes (glass uses wallpapers). */
export interface Backdrop {
  base: readonly [string, string, ...string[]];
  blobs: MeshBlob[];
  light: boolean;
}

export interface TextStyleToken {
  fontSize: number;
  fontWeight: '300' | '400' | '500' | '600' | '700';
  letterSpacing?: number;
  lineHeight?: number;
}

export interface ThemeDefinition {
  name: string;
  label: string;
  description: string;
  appearance: 'dark' | 'light';
  /** Glass themes render translucent blurred surfaces over a wallpaper. */
  isGlass: boolean;
  gradient: readonly [string, string, ...string[]];
  backdrop: Backdrop | null;
  glows: Record<GlowName, GlowPalette>;
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    /** Opaque card color used when the system asks to reduce transparency. */
    surfaceOpaque: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    /** Main action fill (white pill). Must stay a 6-digit hex: some code appends alpha. */
    primary: string;
    /** Text/icons drawn on a `primary` fill. */
    onPrimary: string;
    primaryLight: string;
    /** Small highlights and links. */
    accent: string;
    border: string;
    borderLight: string;
    success: string;
    warning: string;
    error: string;
    tabBarActive: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; screen: number };
  borderRadius: { sm: number; md: number; lg: number; xl: number; full: number };
  typography: {
    display: TextStyleToken;
    title: TextStyleToken;
    body: TextStyleToken;
    label: TextStyleToken;
    caption: TextStyleToken;
    overline: TextStyleToken;
  };
}
