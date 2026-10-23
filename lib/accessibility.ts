import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';

// Live system accessibility preferences. Native reads AccessibilityInfo; web
// uses the equivalent CSS media queries.

type Setting = {
  read: () => Promise<boolean>;
  event:
    | 'reduceMotionChanged'
    | 'reduceTransparencyChanged'
    | 'darkerSystemColorsChanged'
    | 'highTextContrastChanged';
  media: string;
};

function useSystemSetting({ read, event, media }: Setting): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mq = window.matchMedia(media);
      setEnabled(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setEnabled(e.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    let mounted = true;
    read()
      .then((v) => mounted && setEnabled(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [read, event, media]);

  return enabled;
}

const REDUCE_MOTION: Setting = {
  read: () => AccessibilityInfo.isReduceMotionEnabled(),
  event: 'reduceMotionChanged',
  media: '(prefers-reduced-motion: reduce)',
};

const REDUCE_TRANSPARENCY: Setting = {
  read: () =>
    Platform.OS === 'ios' ? AccessibilityInfo.isReduceTransparencyEnabled() : Promise.resolve(false),
  event: 'reduceTransparencyChanged',
  media: '(prefers-reduced-transparency: reduce)',
};

/** True when the user has asked the system to minimise animation. */
export function useReduceMotion(): boolean {
  return useSystemSetting(REDUCE_MOTION);
}

/** True when the user has asked for less transparency (glass should go opaque). */
export function useReduceTransparency(): boolean {
  return useSystemSetting(REDUCE_TRANSPARENCY);
}

const INCREASE_CONTRAST: Setting = {
  read: () =>
    Platform.OS === 'ios'
      ? AccessibilityInfo.isDarkerSystemColorsEnabled()
      : Platform.OS === 'android'
      ? AccessibilityInfo.isHighTextContrastEnabled()
      : Promise.resolve(false),
  event: Platform.OS === 'android' ? 'highTextContrastChanged' : 'darkerSystemColorsChanged',
  media: '(prefers-contrast: more)',
};

/** True when the system asks for higher contrast (iOS Increase Contrast, Android high-contrast text). */
export function useIncreaseContrast(): boolean {
  return useSystemSetting(INCREASE_CONTRAST);
}

/**
 * True when surfaces should be solid instead of see-through glass: the system's
 * Reduce Transparency or Increase Contrast, or the in-app "Solid surfaces" switch.
 * Translucent glass can't guarantee text contrast over a bright wallpaper; solid
 * surfaces always meet WCAG AA.
 */
export function useSolidSurfaces(): boolean {
  const reduceTransparency = useReduceTransparency();
  const increaseContrast = useIncreaseContrast();
  const solidSurfaces = useSettingsStore((s) => s.solidSurfaces);
  return reduceTransparency || increaseContrast || solidSurfaces;
}

type A11yState = {
  checked?: boolean | 'mixed';
  /** Only for tab/option-like roles (ARIA disallows aria-selected on buttons). */
  selected?: boolean;
  /** Toggle buttons: aria-pressed on web, announced as "selected" on iOS. */
  pressed?: boolean;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
};

/**
 * Accessibility state that works on every platform. Spread it onto a control:
 * `<Pressable {...a11yState({ checked: done })} />`.
 * react-native-web ignores `accessibilityState` and only reads `aria-*`, so we
 * emit both (React Native 0.71+ understands the `aria-*` props natively too).
 */
export function a11yState(state?: A11yState) {
  if (!state) return {};
  const { pressed, ...rest } = state;
  return {
    accessibilityState: pressed != null ? { ...rest, selected: pressed } : rest,
    'aria-pressed': Platform.OS === 'web' ? pressed : undefined,
    'aria-checked': state.checked,
    'aria-selected': state.selected,
    'aria-disabled': state.disabled,
    'aria-busy': state.busy,
    'aria-expanded': state.expanded,
  };
}

/** Props that hide a purely decorative element from screen readers. */
export const decorative = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

/** Expand a small visual control's touch area to at least 44pt (Apple HIG / WCAG 2.5.5). */
export function hitSlopFor(size: number) {
  const pad = Math.max(0, Math.ceil((44 - size) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}
