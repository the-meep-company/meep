import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { themes, type ThemeName } from '@/themes';

export default function SettingsScreen() {
  const { theme, themeName, setTheme } = useThemeStore();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>

      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        Theme
      </Text>

      {(Object.keys(themes) as ThemeName[]).map((name) => (
        <TouchableOpacity
          key={name}
          testID={`theme-${name}`}
          accessibilityRole="button"
          style={[
            styles.themeOption,
            {
              backgroundColor: themeName === name ? theme.colors.primaryLight : theme.colors.surface,
              borderColor: themeName === name ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.borderRadius.md,
            },
          ]}
          onPress={() => setTheme(name)}
        >
          <View
            style={[
              styles.themePreview,
              {
                backgroundColor: themes[name].colors.primary,
                borderRadius: theme.borderRadius.sm,
              },
            ]}
          />
          <View style={styles.themeInfo}>
            <Text style={[styles.themeName, { color: theme.colors.text }]}>
              {themes[name].label}
            </Text>
            <Text style={[styles.themeDesc, { color: theme.colors.textSecondary }]}>
              {name === 'minimal' && 'Clean whites, soft blues, lots of space'}
              {name === 'playful' && 'Bold colors, warm tones, rounded shapes'}
              {name === 'sleek' && 'Dark backgrounds, neon accents, modern feel'}
            </Text>
          </View>
          {themeName === name && (
            <Text style={{ color: theme.colors.primary, fontSize: 18 }}>✓</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    marginTop: 60,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  themePreview: {
    width: 40,
    height: 40,
    marginRight: 14,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  themeDesc: {
    fontSize: 13,
  },
});
