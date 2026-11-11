import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useMeepleStore } from '@/stores/meepleStore';
import { MEEPLE_TEMPLATES } from '@/lib/meeples';
import GlassBackground from '@/components/common/GlassBackground';
import ScreenHeader from '@/components/ui/ScreenHeader';
import IconButton from '@/components/ui/IconButton';
import Card from '@/components/ui/Card';
import { DisplayTitle, SectionLabel } from '@/components/ui/Typography';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import { decorative } from '@/lib/accessibility';

export default function MeeplesScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const meeples = useMeepleStore((s) => s.meeples);
  const workingIds = useMeepleStore((s) => s.workingIds);

  const newMeeple = (template?: number) =>
    router.push(template == null ? '/meeples/edit' : { pathname: '/meeples/edit', params: { template: String(template) } });

  return (
    <GlassBackground>
      <ScreenHeader
        left={<IconButton icon="chevron-left" iconSize={14} accessibilityLabel="Back" onPress={() => router.back()} />}
        right={
          <IconButton
            icon="plus"
            variant="primary"
            accessibilityLabel="New meeple"
            testID="new-meeple"
            onPress={() => newMeeple()}
          />
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.screen,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <DisplayTitle lead="Your" title="meeples" style={styles.title} />
        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          Little agents, each with one job. Give one a brief, hand it tasks, and check in when you want an update.
        </Text>

        {meeples.length > 0 && (
          <View style={styles.list}>
            {meeples.map((m) => {
              const working = workingIds.includes(m.id);
              const last = m.messages[m.messages.length - 1];
              const preview = working
                ? 'Working on it…'
                : last
                ? `${last.role === 'user' ? 'You: ' : ''}${last.content.replace(/\s+/g, ' ')}`
                : 'No tasks yet — say hello';
              return (
                <Pressable
                  key={m.id}
                  testID={`meeple-${m.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.name}, ${m.role}${m.unread ? ', new reply' : ''}. ${preview}`}
                  onPress={() => router.push({ pathname: '/meeples/[id]', params: { id: m.id } })}
                  style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}
                >
                  <Card radius={theme.borderRadius.lg} style={styles.row}>
                    <MeepleAvatar icon={m.icon} glow={m.glow} />
                    <View style={styles.rowText}>
                      <View style={styles.nameLine}>
                        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text style={[styles.role, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                          {m.role}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.preview,
                          { color: m.unread ? theme.colors.text : theme.colors.textSecondary },
                          m.unread && styles.previewUnread,
                        ]}
                        numberOfLines={2}
                      >
                        {preview}
                      </Text>
                    </View>
                    {m.unread ? (
                      <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} {...decorative} />
                    ) : (
                      <FontAwesome name="chevron-right" size={12} color={theme.colors.textTertiary} {...decorative} />
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionLabel style={styles.section}>{meeples.length ? 'Add another' : 'Start with one'}</SectionLabel>
        <View style={styles.list}>
          {MEEPLE_TEMPLATES.map((t, i) => (
            <Pressable
              key={t.name}
              testID={`template-${t.name}`}
              accessibilityRole="button"
              accessibilityLabel={`New ${t.role}: ${t.blurb}`}
              onPress={() => newMeeple(i)}
              style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}
            >
              <Card radius={theme.borderRadius.lg} style={styles.row}>
                <MeepleAvatar icon={t.icon} glow={t.glow} size={40} />
                <View style={styles.rowText}>
                  <Text style={[styles.templateName, { color: theme.colors.text }]}>{t.role}</Text>
                  <Text style={[styles.preview, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    {t.blurb}
                  </Text>
                </View>
                <FontAwesome name="plus" size={12} color={theme.colors.textTertiary} {...decorative} />
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 12 },
  intro: { fontSize: 15, lineHeight: 21, marginTop: 10, marginBottom: 20 },
  list: { gap: 10 },
  section: { marginTop: 28, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowText: { flex: 1, gap: 3 },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  role: { fontSize: 13, flexShrink: 1 },
  templateName: { fontSize: 15, fontWeight: '600' },
  preview: { fontSize: 14, lineHeight: 19 },
  previewUnread: { fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
