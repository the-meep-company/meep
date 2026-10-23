import { Platform } from 'react-native';
import type { BlurTint } from 'expo-blur';
import { useSettingsStore } from '@/stores/settingsStore';
import type { GlassStyle } from '@/types';

// Glass materials. Each surface is layered: blur → fill → glossy top sheen →
// rim light (inset highlights) + an edge that's brighter on the top/left, like
// light catching the rim of a pane.
//
// Web draws the blur itself with backdrop-filter so it can also *refract*:
// `refract` runs the backdrop through an SVG displacement map that bends the
// background near the edges (the Liquid Glass lens effect — same technique as
// anniefang.co's nav). Native uses the system blur (expo-blur) instead.

export interface GlassPreset {
  label: string;
  subtitle: string;
  // Native (expo-blur)
  intensity: number;
  tint: BlurTint;
  // Web (backdrop-filter)
  webBlur: number; // px
  webSaturate: number;
  webVeil: string; // color layered under the blur
  /** Web lens effect: 'pill' for capsules (strong), 'card' for rounded rectangles (gentle). */
  refract: false | 'pill' | 'card';
  // Shared
  fill: string;
  border: string;
  edge: string; // top + left highlight
  rim: number; // inset rim-light alpha
  sheen: readonly [string, string];
}

export const GLASS_PRESETS: Record<GlassStyle, GlassPreset> = {
  clear: {
    label: 'Clear',
    subtitle: 'Lightest',
    intensity: 12,
    tint: 'systemUltraThinMaterialDark',
    webBlur: 2,
    webSaturate: 1.8,
    webVeil: 'rgba(255,255,255,0.04)',
    refract: 'card',
    fill: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.20)',
    edge: 'rgba(255,255,255,0.60)',
    rim: 0.35,
    sheen: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'],
  },
  frosted: {
    label: 'Frosted',
    subtitle: 'Balanced',
    intensity: 55,
    tint: 'systemThinMaterialDark',
    webBlur: 14,
    webSaturate: 1.6,
    webVeil: 'rgba(28,28,34,0.30)', // smoky frost
    refract: false,
    fill: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.14)',
    edge: 'rgba(255,255,255,0.38)',
    rim: 0.16,
    sheen: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'],
  },
  blur: {
    label: 'Blur',
    subtitle: 'Most frosted',
    intensity: 100,
    tint: 'systemMaterialDark',
    webBlur: 26,
    webSaturate: 1.4,
    webVeil: 'rgba(235,235,245,0.22)', // milky
    refract: false,
    fill: 'rgba(0,0,0,0.16)', // keeps white text readable through the milk
    border: 'rgba(255,255,255,0.12)',
    edge: 'rgba(255,255,255,0.26)',
    rim: 0.12,
    sheen: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'],
  },
};

export const GLASS_STYLE_ORDER: GlassStyle[] = ['clear', 'frosted', 'blur'];

/** Liquid Glass for the floating tab bar — always refractive, tinted to the theme. */
export const NAV_GLASS: Record<'dark' | 'light', GlassPreset> = {
  dark: {
    label: 'Nav',
    subtitle: '',
    intensity: 40,
    tint: 'systemUltraThinMaterialDark',
    webBlur: 6,
    webSaturate: 1.8,
    webVeil: 'rgba(29,29,27,0.38)',
    refract: 'pill',
    fill: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.16)',
    edge: 'rgba(255,255,255,0.45)',
    rim: 0.18,
    sheen: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'],
  },
  light: {
    label: 'Nav',
    subtitle: '',
    intensity: 40,
    tint: 'systemUltraThinMaterialLight',
    webBlur: 4,
    webSaturate: 1.8,
    webVeil: 'rgba(255,253,246,0.62)',
    refract: 'pill',
    fill: 'rgba(255,255,255,0.10)',
    border: 'rgba(0,0,0,0.06)',
    edge: 'rgba(255,255,255,0.9)',
    rim: 0.4,
    sheen: ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)'],
  },
};

/** The user's chosen glass preset, or an explicit override (e.g. for previews). */
export function useGlassPreset(override?: GlassStyle): GlassPreset {
  const glassStyle = useSettingsStore((s) => s.glassStyle);
  return GLASS_PRESETS[override ?? glassStyle];
}

/** backdrop-filter value for a preset on web. */
export function webBackdrop(preset: GlassPreset): string {
  const refraction = preset.refract ? `url(#${LIQUID_GLASS_FILTER_ID}-${preset.refract}) ` : '';
  return `${refraction}blur(${preset.webBlur}px) saturate(${preset.webSaturate}) brightness(1.05)`;
}

/** Inset rim light (soft inner glow + top/bottom hairlines). */
export function rimShadow(alpha: number): string {
  return [
    `inset 0 1px 1px rgba(255,255,255,${alpha})`,
    `inset 0 -1px 1px rgba(255,255,255,${(alpha / 2).toFixed(3)})`,
    `inset 0 0 18px rgba(255,255,255,${alpha})`,
  ].join(', ');
}

// ---- Web refraction filter ------------------------------------------------

export const LIQUID_GLASS_FILTER_ID = 'meep-liquid-glass';

// Displacement map: red ramps across the left/right 5% edges, green across the
// top/bottom 20%; 128 (neutral) in the middle. Displacing the backdrop by it
// bends what's behind the glass near its rim, like light through a lens.
const ramp = (axis: 'x' | 'y', channel: 'r' | 'g', edge: number) => {
  const c = (v: number) => (channel === 'r' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`);
  const dir = axis === 'x' ? "x2='1' y2='0'" : "x2='0' y2='1'";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>` +
    `<linearGradient id='g' ${dir}>` +
    `<stop offset='0' stop-color='${c(255)}'/><stop offset='${edge}' stop-color='${c(128)}'/>` +
    `<stop offset='${1 - edge}' stop-color='${c(128)}'/><stop offset='1' stop-color='${c(0)}'/>` +
    `</linearGradient><rect width='100' height='100' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// A capsule's round ends hide its corners, so it can bend hard. Rounded
// rectangles can't: at a corner both ramps push the sample outside the
// backdrop at once, which shows up as a diamond — so cards bend gently.
const filter = (kind: 'pill' | 'card', scale: number) =>
  `<filter id="${LIQUID_GLASS_FILTER_ID}-${kind}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
  `<feImage href="${ramp('x', 'r', 0.05)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="h"/>` +
  `<feImage href="${ramp('y', 'g', 0.2)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="v"/>` +
  `<feComposite in="h" in2="v" operator="arithmetic" k2="1" k3="1" result="map"/>` +
  `<feGaussianBlur in="map" stdDeviation="1.5" result="soft"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="soft" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>` +
  `</filter>`;

/** Injects the SVG refraction filters into the page once (web only, no-op elsewhere). */
export function ensureLiquidGlassFilter() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(`${LIQUID_GLASS_FILTER_ID}-pill`)) return;
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<svg width="0" height="0">${filter('pill', 36)}${filter('card', 10)}</svg>`;
  document.body.appendChild(holder);
}
