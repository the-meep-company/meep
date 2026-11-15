import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/stores/themeStore';

const THUMB = 28;
const TRACK = 6;

interface SliderProps {
  /** 0 to 1. */
  value: number;
  /** Fires while dragging (only when the value actually changes). */
  onChange: (value: number) => void;
  /** Fires once when the drag ends. */
  onChangeEnd?: (value: number) => void;
  /** Snap to this many evenly spaced stops (e.g. 3 = start, middle, end). */
  steps?: number;
  /** What the slider controls, for screen readers (e.g. "Grain"). */
  accessibilityLabel: string;
  /** The current value in words, for screen readers (e.g. "35 percent"). */
  accessibilityValueText: string;
  /** Paint the whole track with a gradient (e.g. a hue spectrum) instead of a fill. */
  trackColors?: readonly [string, string, ...string[]];
  /** Thumb color; defaults to white. */
  thumbColor?: string;
  testID?: string;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** A horizontal slider. Drag anywhere on it; VoiceOver/TalkBack adjust it by swiping. */
export default function Slider({
  value,
  onChange,
  onChangeEnd,
  steps,
  accessibilityLabel,
  accessibilityValueText,
  trackColors,
  thumbColor,
  testID,
}: SliderProps) {
  const { theme } = useThemeStore();
  const [width, setWidth] = useState(0);

  const snap = (v: number) => (steps && steps > 1 ? Math.round(v * (steps - 1)) / (steps - 1) : v);

  // The responder is created once, so it reads the latest props through a ref.
  const live = useRef({ value, width, onChange, onChangeEnd, snap });
  live.current = { value, width, onChange, onChangeEnd, snap };
  const drag = useRef({ startX: 0, last: value });

  const responder = useMemo(() => {
    const move = (x: number) => {
      const { width: w, onChange: change, snap: snapTo } = live.current;
      if (w <= THUMB) return;
      const next = snapTo(clamp((x - THUMB / 2) / (w - THUMB)));
      if (next !== drag.current.last) {
        drag.current.last = next;
        change(next);
      }
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Don't let a parent ScrollView steal the drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        // Children ignore touches, so locationX is relative to the slider itself.
        drag.current = { startX: e.nativeEvent.locationX, last: live.current.value };
        move(drag.current.startX);
      },
      onPanResponderMove: (_, g) => move(drag.current.startX + g.dx),
      onPanResponderRelease: () => live.current.onChangeEnd?.(drag.current.last),
      onPanResponderTerminate: () => live.current.onChangeEnd?.(drag.current.last),
    });
  }, []);

  const nudge = (direction: 1 | -1) => {
    const step = steps && steps > 1 ? 1 / (steps - 1) : 0.1;
    const next = snap(clamp(value + direction * step));
    if (next !== value) {
      onChange(next);
      onChangeEnd?.(next);
    }
  };

  const x = clamp(value) * Math.max(0, width - THUMB);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.root}
      {...responder.panHandlers}
    >
      <View style={styles.inner} pointerEvents="none">
        {trackColors ? (
          <LinearGradient
            colors={trackColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.track, styles.wideTrack]}
          />
        ) : (
          <>
            <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.14)' }]} />
            <View
              style={[styles.track, { right: undefined, width: x + THUMB / 2, backgroundColor: theme.colors.accent }]}
            />
            {steps && steps > 1 && width > 0
              ? Array.from({ length: steps }, (_, i) => (
                  <View
                    key={i}
                    style={[styles.stop, { left: (i / (steps - 1)) * (width - THUMB) + THUMB / 2 - 2 }]}
                  />
                ))
              : null}
          </>
        )}
        <View
          style={[
            styles.thumb,
            { left: x, backgroundColor: thumbColor ?? '#FFFFFF' },
            thumbColor ? styles.thumbRing : null,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Taller than the thumb so the touch target reaches 44pt.
  root: { height: 44, justifyContent: 'center' },
  inner: { height: THUMB, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK,
    borderRadius: TRACK / 2,
  },
  wideTrack: { height: 10, borderRadius: 5 },
  stop: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  thumbRing: { borderWidth: 3, borderColor: '#FFFFFF' },
});
