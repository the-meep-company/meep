// The accent colour: small highlights, links and switch tracks. The user picks a
// preset or their own hue (Settings → Appearance). Saturation and lightness are
// fixed for custom hues so every choice stays readable on the dark UI.

export type AccentId = 'sky' | 'apricot' | 'rose' | 'lime' | 'plum' | 'ocean';

export const ACCENT_PRESETS: { id: AccentId; name: string; color: string }[] = [
  { id: 'sky', name: 'Sky', color: '#A9CBFF' },
  { id: 'apricot', name: 'Apricot', color: '#F2A07B' },
  { id: 'rose', name: 'Rose', color: '#F4A6B8' },
  { id: 'lime', name: 'Lime', color: '#B7D257' },
  { id: 'plum', name: 'Plum', color: '#C4B5FD' },
  { id: 'ocean', name: 'Ocean', color: '#5DB3C4' },
];

export const DEFAULT_ACCENT: AccentId = 'sky';
export const DEFAULT_ACCENT_HUE = 265;

const CUSTOM_SATURATION = 0.9;
const CUSTOM_LIGHTNESS = 0.8;

/** A pastel 6-digit hex for a hue in degrees (0-360). */
export function hueToAccent(hue: number): string {
  const h = (((hue % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * CUSTOM_LIGHTNESS - 1)) * CUSTOM_SATURATION;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = CUSTOM_LIGHTNESS - c / 2;
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/** The hue spectrum, for drawing the custom-colour slider track. */
export const HUE_SPECTRUM = [0, 45, 90, 135, 180, 225, 270, 315, 360].map(hueToAccent) as [
  string,
  string,
  ...string[],
];

export function resolveAccent(id: AccentId | 'custom', hue: number): string {
  if (id === 'custom') return hueToAccent(hue);
  return (ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0]).color;
}
