import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import GlassBackground from '@/components/common/GlassBackground';
import ScreenHeader from '@/components/ui/ScreenHeader';
import IconButton from '@/components/ui/IconButton';

interface SettingsPageProps {
  title: string;
  children: React.ReactNode;
  /** Set false when the page manages its own scrolling (e.g. a long list). */
  scroll?: boolean;
}

/** Shell shared by every settings sub-page: wallpaper, back button, centred title. */
export default function SettingsPage({ title, children, scroll = true }: SettingsPageProps) {
  const router = useRouter();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const padding = { paddingHorizontal: theme.spacing.screen, paddingBottom: insets.bottom + 32 };

  return (
    <GlassBackground centered>
      <ScreenHeader
        title={title}
        left={
          <IconButton
            icon="chevron-left"
            iconSize={14}
            accessibilityLabel="Back"
            testID="settings-back"
            onPress={() => router.back()}
          />
        }
      />
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={padding}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padding]}>{children}</View>
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
