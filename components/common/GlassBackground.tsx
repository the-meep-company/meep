import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  Platform,
  type DimensionValue,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getBackgroundPreset, CUSTOM_PHOTO_SCRIM, type MeshBlob } from '@/lib/backgrounds';
import { decorative } from '@/lib/accessibility';

const GRAIN = require('@/assets/images/grain.png');
const pct = (n: number) => `${n * 100}%` as DimensionValue;

export interface Mesh {
  base: readonly [string, string, ...string[]];
  blobs: MeshBlob[];
  light?: boolean;
}

/**
 * A mesh gradient: base gradient plus soft color blobs. `scale` shrinks the blob
 * softening for smaller surfaces (1 = full phone width).
 */
export function MeshBackground({ preset, scale = 1 }: { preset: Mesh; scale?: number }) {
  return (
    <View style={styles.layer} pointerEvents="none" {...decorative}>
      <LinearGradient
        colors={preset.base}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {preset.blobs.map((blob, i) => (
        <View
          key={i}
          style={[
            styles.blob,
            {
              width: pct(blob.size),
              left: pct(blob.left),
              top: pct(blob.top),
              backgroundColor: blob.color,
              opacity: blob.opacity,
            },
            // Web softens each blob with a CSS filter; native veils them below.
            Platform.OS === 'web' && { filter: `blur(${Math.round(70 * scale)}px)` },
          ]}
        />
      ))}
      {Platform.OS !== 'web' && (
        <BlurView
          tint={preset.light ? 'light' : 'dark'}
          intensity={100}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

/** Repeating film-grain texture. `level` is its strength, 0 (none) to 1. */
export function GrainOverlay({ level }: { level: number }) {
  if (level <= 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" {...decorative}>
      {/* Explicit size: a bundled image otherwise takes its natural 256px size on web */}
      <Image
        source={GRAIN}
        resizeMode="repeat"
        style={{ width: '100%', height: '100%', opacity: Math.min(1, level) }}
      />
    </View>
  );
}

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Full-bleed screen background, wrapping a screen root.
 * The user's wallpaper or photo, a readability scrim, then grain.
 */
export default function GlassBackground({ children, style }: Props) {
  const { theme } = useThemeStore();
  const { glassBackground, customBackgroundUri, grain } = useSettingsStore();

  let layers: React.ReactNode = null;

  if (theme.isGlass) {
    const usePhoto = glassBackground === 'custom' && !!customBackgroundUri;
    const preset = getBackgroundPreset(glassBackground);
    const scrim = usePhoto ? CUSTOM_PHOTO_SCRIM : preset.scrim;
    layers = (
      <>
        {usePhoto ? (
          <View style={StyleSheet.absoluteFill} {...decorative}>
            <Image
              source={{ uri: customBackgroundUri! }}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          <MeshBackground preset={preset} />
        )}
        {scrim > 0 && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrim})` }]}
            pointerEvents="none"
            {...decorative}
          />
        )}
      </>
    );
  }

  return (
    // The screen's main landmark (the floating tab bar is the navigation one).
    <View role="main" style={[styles.fill, { backgroundColor: theme.colors.background }, style]}>
      {layers}
      {theme.isGlass && <GrainOverlay level={grain} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  blob: { position: 'absolute', aspectRatio: 1, borderRadius: 9999 },
});
