import { glass } from './glass';
import { afterglow } from './afterglow';
import type { ThemeDefinition } from './types';

export const themes = {
  glass,
  afterglow,
} satisfies Record<string, ThemeDefinition>;

export type ThemeName = keyof typeof themes;
export type Theme = ThemeDefinition;
export type { GlowName } from './types';

export const DEFAULT_THEME: ThemeName = 'glass';

/** Theme names saved by older versions (minimal/playful/sleek) fall back to the default. */
export function resolveThemeName(name: string | null | undefined): ThemeName {
  return name && name in themes ? (name as ThemeName) : DEFAULT_THEME;
}
