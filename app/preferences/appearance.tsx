import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { MeshBackground } from '@/components/common/GlassBackground';
import Card from '@/components/ui/Card';
import Slider from '@/components/ui/Slider';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';
import { BACKGROUND_PRESETS } from '@/lib/backgrounds';
import { pickBackgroundPhoto } from '@/lib/backgroundPhoto';
import { GLASS_PRESETS, GLASS_STYLE_ORDER } from '@/lib/glass';
import { ACCENT_PRESETS, HUE_SPECTRUM, hueToAccent } from '@/lib/accent';
import { a11yState, decorative } from '@/lib/accessibility';

const SWATCH_WIDTH = 70;
const SWATCH_HEIGHT = 112;

/** Wallpaper, accent colour and how the glass surfaces look. */
export default function AppearanceScreen() {
  const { theme, accentId, accentHue, setAccent, setAccentHue } = useThemeStore();
  const {
    glassStyle, glassBackground, customBackgroundUri, grain, solidSurfaces,
    setGlassStyle, setGlassBackground, setCustomBackground, setGrain, setSolidSurfaces,
  } = useSettingsStore();

  // The hue thumb tracks the finger; the app-wide accent updates when it's released.
  const [dragHue, setDragHue] = useState<number | null>(null);
  const hue = dragHue ?? accentHue;

  const pickPhoto = async () => {
    try {
      const uri = await pickBackgroundPhoto();
      if (uri) setCustomBackground(uri);
    } catch {
      Alert.alert('Couldn’t use that photo', 'Please try a different image.');
    }
  };

  // Tapping your photo selects it; tapping it again (or with no photo yet) picks a new one.
  const onPhotoTile = () => {
    if (customBackgroundUri && glassBackground !== 'custom') setGlassBackground('custom');
    else pickPhoto();
  };

  const swatchLabel = (selected: boolean) => [
    styles.swatchName,
    { color: selected ? theme.colors.text : theme.colors.textSecondary },
  ];
  const swatchBorder = (selected: boolean) => ({
    borderColor: selected ? theme.colors.primary : 'rgba(255,255,255,0.14)',
  });

  const frostIndex = GLASS_STYLE_ORDER.indexOf(glassStyle);
  const photoSelected = glassBackground === 'custom';

  return (
    <SettingsPage title="Appearance">
      <SettingsSection label="Wallpaper">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Bleed to the screen edges so swatches scroll off them, not off a margin.
          style={{ marginHorizontal: -theme.spacing.screen }}
          contentContainerStyle={[styles.swatchRow, { paddingHorizontal: theme.spacing.screen }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Wallpaper"
        >
          {BACKGROUND_PRESETS.map((preset) => {
            const selected = glassBackground === preset.id;
            return (
              <Pressable
                key={preset.id}
                testID={`bg-${preset.id}`}
                accessibilityRole="radio"
                accessibilityLabel={preset.name}
                {...a11yState({ checked: selected })}
                onPress={() => setGlassBackground(preset.id)}
                style={styles.swatchTile}
              >
                <View style={[styles.swatch, swatchBorder(selected)]}>
                  <MeshBackground preset={preset} scale={SWATCH_WIDTH / 375} />
                </View>
                <Text style={swatchLabel(selected)} numberOfLines={1}>
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            testID="bg-custom"
            accessibilityRole={customBackgroundUri ? 'radio' : 'button'}
            accessibilityLabel={customBackgroundUri ? 'Your photo' : 'Add your own photo'}
            {...a11yState(customBackgroundUri ? { checked: photoSelected } : undefined)}
            onPress={onPhotoTile}
            style={styles.swatchTile}
          >
            <View
              style={[
                styles.swatch,
                styles.photoSwatch,
                swatchBorder(photoSelected),
                !customBackgroundUri && styles.photoSwatchEmpty,
              ]}
            >
              {customBackgroundUri ? (
                <Image source={{ uri: customBackgroundUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
              ) : (
                <FontAwesome name="plus" size={18} color={theme.colors.textSecondary} />
              )}
            </View>
            <Text style={swatchLabel(photoSelected)} numberOfLines={1}>
              {customBackgroundUri ? 'Your photo' : 'Add photo'}
            </Text>
          </Pressable>
        </ScrollView>

        {customBackgroundUri && (
          <View style={styles.photoActions}>
            <Pressable onPress={pickPhoto} accessibilityRole="button" hitSlop={12}>
              <Text style={[styles.photoAction, { color: theme.colors.accent }]}>Change photo</Text>
            </Pressable>
            <Pressable onPress={() => setCustomBackground(null)} accessibilityRole="button" hitSlop={12}>
              <Text style={[styles.photoAction, { color: theme.colors.error }]}>Remove photo</Text>
            </Pressable>
          </View>
        )}
      </SettingsSection>

      <SettingsSection label="Accent">
        <Card radius={theme.borderRadius.md}>
          <View style={styles.accentRow} accessibilityRole="radiogroup" accessibilityLabel="Accent colour">
            {ACCENT_PRESETS.map((preset) => {
              const selected = accentId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  testID={`accent-${preset.id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={preset.name}
                  {...a11yState({ checked: selected })}
                  onPress={() => setAccent(preset.id)}
                  style={[styles.accentRing, selected && { borderColor: theme.colors.primary }]}
                >
                  <View style={[styles.accentDot, { backgroundColor: preset.color }]} />
                </Pressable>
              );
            })}
            <Pressable
              testID="accent-custom"
              accessibilityRole="radio"
              accessibilityLabel="Custom colour"
              {...a11yState({ checked: accentId === 'custom' })}
              onPress={() => setAccent('custom')}
              style={[styles.accentRing, accentId === 'custom' && { borderColor: theme.colors.primary }]}
            >
              <LinearGradient
                colors={HUE_SPECTRUM}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.accentDot}
                {...decorative}
              />
            </Pressable>
          </View>

          {accentId === 'custom' && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} {...decorative} />
              <View style={styles.sliderRow}>
                <Text style={[styles.sliderTitle, { color: theme.colors.text }]}>Custom colour</Text>
                <Slider
                  testID="accent-hue"
                  value={hue / 360}
                  onChange={(v) => setDragHue(Math.round(v * 360))}
                  onChangeEnd={(v) => {
                    setAccentHue(Math.round(v * 360));
                    setDragHue(null);
                  }}
                  trackColors={HUE_SPECTRUM}
                  thumbColor={hueToAccent(hue)}
                  accessibilityLabel="Custom accent colour"
                  accessibilityValueText={`Hue ${hue} degrees`}
                />
              </View>
            </>
          )}
        </Card>
      </SettingsSection>

      <SettingsSection label="Surfaces">
        <Card radius={theme.borderRadius.md} style={styles.groupGap}>
          <View style={styles.sliderRow}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sliderTitle, { color: theme.colors.text }]}>Frost</Text>
              <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>
                {GLASS_PRESETS[glassStyle].label}
              </Text>
            </View>
            <Slider
              testID="frost-slider"
              value={frostIndex / (GLASS_STYLE_ORDER.length - 1)}
              steps={GLASS_STYLE_ORDER.length}
              onChange={(v) => setGlassStyle(GLASS_STYLE_ORDER[Math.round(v * (GLASS_STYLE_ORDER.length - 1))])}
              accessibilityLabel="Frost"
              accessibilityValueText={GLASS_PRESETS[glassStyle].label}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} {...decorative} />
          <View style={styles.sliderRow}>
            <View style={styles.sliderHeader}>
              <Text style={[styles.sliderTitle, { color: theme.colors.text }]}>Grain</Text>
              <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>
                {grain <= 0 ? 'Off' : `${Math.round(grain * 100)}%`}
              </Text>
            </View>
            <Slider
              testID="grain-slider"
              value={grain}
              onChange={(v) => setGrain(Math.round(v * 20) / 20)}
              accessibilityLabel="Grain"
              accessibilityValueText={grain <= 0 ? 'Off' : `${Math.round(grain * 100)} percent`}
            />
          </View>
        </Card>
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            testID="solid-surfaces"
            title="Solid surfaces"
            description="Solid cards instead of glass, for the clearest text"
            value={solidSurfaces}
            onValueChange={setSolidSurfaces}
          />
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  swatchRow: { gap: 8 },
  swatchTile: { width: SWATCH_WIDTH },
  swatch: {
    width: SWATCH_WIDTH,
    height: SWATCH_HEIGHT,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
  },
  photoSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  photoSwatchEmpty: { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.28)' },
  swatchName: { fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 5 },
  photoActions: { flexDirection: 'row', gap: 24, marginTop: 14, marginLeft: 4 },
  photoAction: { fontSize: 14, fontWeight: '600' },
  accentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // 40pt ring + the row's padding keeps each swatch a comfortable touch target.
  accentRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentDot: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  groupGap: { marginBottom: 8 },
  sliderRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderTitle: { fontSize: 16, fontWeight: '500' },
  sliderValue: { fontSize: 15 },
});
