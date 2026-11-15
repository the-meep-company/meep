import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import Card from '@/components/ui/Card';
import { a11yState, decorative } from '@/lib/accessibility';
import { listTimeZones, timeZoneCity, timeZoneOffset, timeZoneRegion } from '@/lib/timezones';

interface Zone {
  id: string;
  city: string;
  detail: string;
  search: string;
}

/** Searchable list of every time zone. Picking one goes back. */
export default function TimeZonePickerScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { timezone, setTimezone } = useSettingsStore();
  const [query, setQuery] = useState('');

  const zones = useMemo<Zone[]>(
    () =>
      listTimeZones().map((id) => {
        const city = timeZoneCity(id);
        const detail = [timeZoneRegion(id), timeZoneOffset(id)].filter(Boolean).join(' · ');
        return { id, city, detail, search: `${city} ${id} ${detail}`.toLowerCase() };
      }),
    []
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? zones.filter((z) => z.search.includes(q)) : zones;
  }, [zones, query]);

  const choose = (id: string) => {
    setTimezone(id);
    router.back();
  };

  return (
    <SettingsPage title="Time zone" scroll={false}>
      <Card radius={theme.borderRadius.md} style={styles.search}>
        {/* Content sits in a View: on web bare text/inputs would paint under the card's glass layers. */}
        <View style={styles.searchRow}>
          <FontAwesome name="search" size={14} color={theme.colors.textTertiary} {...decorative} />
          <TextInput
            testID="time-zone-search"
            style={[styles.searchInput, { color: theme.colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities"
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel="Search time zones"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </Card>

      {/* One glass card holding a virtualized list: hundreds of rows, one surface. */}
      <Card radius={theme.borderRadius.md} style={styles.list}>
        <FlatList
          data={results}
          keyExtractor={(z) => z.id}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={16}
          accessibilityRole="radiogroup"
          accessibilityLabel="Time zone"
          ItemSeparatorComponent={() => (
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} {...decorative} />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
              No time zones match “{query.trim()}”.
            </Text>
          }
          renderItem={({ item }) => {
            const selected = item.id === timezone;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`${item.city}, ${item.detail}`}
                {...a11yState({ checked: selected })}
                onPress={() => choose(item.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.text}>
                  <Text style={[styles.city, { color: theme.colors.text }]}>{item.city}</Text>
                  {item.detail ? (
                    <Text style={[styles.detail, { color: theme.colors.textSecondary }]}>{item.detail}</Text>
                  ) : null}
                </View>
                {selected && <FontAwesome name="check" size={14} color={theme.colors.accent} {...decorative} />}
              </Pressable>
            );
          }}
        />
      </Card>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 16, marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 14 },
  list: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  city: { fontSize: 16, fontWeight: '500' },
  detail: { fontSize: 13 },
  empty: { fontSize: 14, textAlign: 'center', padding: 24 },
});
