import { minimal } from './minimal';
import { playful } from './playful';
import { sleek } from './sleek';

export const themes = {
  minimal,
  playful,
  sleek,
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = (typeof themes)[ThemeName];
