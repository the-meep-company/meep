import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { isBot, useMeepleStore } from '@/stores/meepleStore';
import { MEEPLE_TEMPLATES } from '@/lib/meeples';
import { TRUST_OPTIONS, describeWhen } from '@/lib/bots';
import PillTabs from '@/components/ui/PillTabs';
import type { Meeple } from '@/types';
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
  const all = useMeepleStore((s) => s.meeples);
  const workingIds = useMeepleStore((s) => s.workingIds);
  const updateMeeple = useMeepleStore((s) => s.updateMeeple);
  const bots = all.filter(isBot);
  const meeples = all.filter((m) => !isBot(m));
  const open = (m: Meeple) => router.push({ pathname: '/meeples/[id]', params: { id: m.id } });

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
        <DisplayTitle lead="Your" title="crew" style={styles.title} />
        <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
          Bots work on your calendar while you're not looking. Meeples are agents you hand tasks to and check in on.
        </Text>

        {bots.length > 0 && (
          <>
            <SectionLabel style={styles.sectionFirst}>Bots</SectionLabel>
            <View style={styles.list}>
              {bots.map((b) => (
                <Card key={b.id} radius={theme.borderRadius.lg} style={styles.botCard}>
                  <Pressable
                    testID={`bot-${b.name}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.name}. ${b.role}. ${describeWhen(b)}${b.enabled ? '' : ', paused'}${b.unread ? ', something new' : ''}`}
                    accessibilityHint="Opens its thread and recent runs"
                    onPress={() => open(b)}
                    style={({ pressed }) => [styles.botTop, pressed && { opacity: 0.7 }]}
                  >
                    <MeepleAvatar icon={b.icon} glow={b.glow} size={44} />
                    <View style={styles.rowText}>
                      <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                        {b.name}
                      </Text>
                      <Text style={[styles.preview, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {b.role}
                      </Text>
                      <Text style={[styles.when, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                        {workingIds.includes(b.id) ? 'Working on it…' : describeWhen(b)}
                      </Text>
                    </View>
                    {b.unread && <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} {...decorative} />}
                    <Switch
                      value={b.enabled}
                      onValueChange={(enabled) => updateMeeple(b.id, { enabled })}
                      accessibilityLabel={`${b.name} running`}
                      trackColor={{ true: theme.colors.primary }}
                      thumbColor={b.enabled ? theme.colors.onPrimary : undefined}
                    />
                  </Pressable>
                  <PillTabs
                    layout="fill"
                    semantics="radio"
                    accessibilityLabel={`${b.name} trust`}
                    options={TRUST_OPTIONS.map(({ value, label }) => ({ value, label }))}
                    value={b.trust}
                    onChange={(trust) => updateMeeple(b.id, { trust })}
                  />
                </Card>
              ))}
            </View>
          </>
        )}

        {meeples.length > 0 && <SectionLabel style={styles.section}>Meeples</SectionLabel>}

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
                  onPress={() => open(m)}
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

        <SectionLabel style={styles.section}>{all.length ? 'Add another' : 'Start with one'}</SectionLabel>
        <View style={styles.list}>
          <Pressable
            testID="new-bot"
            accessibilityRole="button"
            accessibilityLabel="Write a bot: tell it what to do and when, and it works on your calendar"
            onPress={() => router.push('/meeples/new-bot')}
            style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}
          >
            <Card radius={theme.borderRadius.lg} style={styles.row}>
              <MeepleAvatar icon="magic" glow="sky" size={40} />
              <View style={styles.rowText}>
                <Text style={[styles.templateName, { color: theme.colors.text }]}>Write a bot</Text>
                <Text style={[styles.preview, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  Tell it what to do and when; it works on your calendar
                </Text>
              </View>
              <FontAwesome name="plus" size={12} color={theme.colors.textTertiary} {...decorative} />
            </Card>
          </Pressable>
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
  sectionFirst: { marginTop: 4, marginBottom: 12 },
  botCard: { padding: 14, gap: 12 },
  botTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  when: { fontSize: 13 },
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
