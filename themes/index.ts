import { glass } from './glass';
import type { ThemeDefinition } from './types';

export const themes = {
  glass,
} satisfies Record<string, ThemeDefinition>;

export type ThemeName = keyof typeof themes;
export type Theme = ThemeDefinition;
export type { GlowName } from './types';

export const DEFAULT_THEME: ThemeName = 'glass';

/**
 * Theme names saved by older versions (minimal/playful/sleek/afterglow) fall back to
 * the default. Afterglow's look lives on as a wallpaper + accent + solid surfaces,
 * see applyAfterglowLook in stores/themeStore.
 */
export function resolveThemeName(name: string | null | undefined): ThemeName {
  return name && name in themes ? (name as ThemeName) : DEFAULT_THEME;
}
