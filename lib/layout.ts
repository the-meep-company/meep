import { Platform, useWindowDimensions } from 'react-native';

/** Browser windows at least this wide get the desktop layout (sidebar, centered column). */
export const WIDE_BREAKPOINT = 900;

/** Max width of a screen's content column in the desktop layout. */
export const CONTENT_MAX_WIDTH = 720;

/** True on web when the window is wide enough for the desktop layout. */
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}
