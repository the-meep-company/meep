import { useEffect, useRef } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useMeepleStore } from '@/stores/meepleStore';
import { CHECK_IN_TEXT, sendToMeeple } from '@/lib/meeples';
import { applyChatAction } from '@/lib/chatActions';
import GlassBackground from '@/components/common/GlassBackground';
import ScreenHeader from '@/components/ui/ScreenHeader';
import IconButton from '@/components/ui/IconButton';
import ChatBubble from '@/components/braindump/ChatBubble';
import ChatInput from '@/components/braindump/ChatInput';
import ActionConfirmCard from '@/components/braindump/ActionConfirmCard';
import MeepleAvatar from '@/components/meeples/MeepleAvatar';
import { decorative } from '@/lib/accessibility';

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function MeepleThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const meeple = useMeepleStore((s) => s.meeples.find((m) => m.id === id));
  const working = useMeepleStore((s) => s.workingIds.includes(id));
  const setOpen = useMeepleStore((s) => s.setOpen);
  const setActionStatus = useMeepleStore((s) => s.setActionStatus);
  const scrollRef = useRef<ScrollView>(null);

  // While this thread is on screen its replies are read as they arrive.
  useEffect(() => {
    setOpen(id);
    return () => setOpen(null);
  }, [id, setOpen]);

  // Deleted from the edit sheet: leave the thread.
  useEffect(() => {
    if (!meeple) router.back();
  }, [meeple, router]);

  if (!meeple) return null;

  const checkIn = () => sendToMeeple(meeple.id, CHECK_IN_TEXT);

  return (
    <GlassBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader
          title={meeple.name}
          left={<IconButton icon="chevron-left" iconSize={14} accessibilityLabel="Back" onPress={() => router.back()} />}
          right={
            <>
              <IconButton
                icon="refresh"
                accessibilityLabel="Check in"
                accessibilityHint={`Asks ${meeple.name} for an update on its brief`}
                testID="meeple-check-in"
                disabled={working}
                onPress={checkIn}
              />
              <IconButton
                icon="pencil"
                accessibilityLabel={`Edit ${meeple.name}`}
                testID="meeple-edit"
                onPress={() => router.push({ pathname: '/meeples/edit', params: { id: meeple.id } })}
              />
            </>
          }
        />

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* The meeple's card: who it is and what it's in charge of */}
          <View style={[styles.intro, { paddingHorizontal: theme.spacing.screen }]}>
            <MeepleAvatar icon={meeple.icon} glow={meeple.glow} size={72} />
            <Text style={[styles.role, { color: theme.colors.text }]}>{meeple.role}</Text>
            <Text style={[styles.brief, { color: theme.colors.textSecondary }]} numberOfLines={4}>
              {meeple.instructions}
            </Text>
            <View style={styles.skills}>
              {meeple.webSearch && <Skill icon="globe" label="Searches the web" />}
              {meeple.scheduleAccess && <Skill icon="calendar" label="Sees your schedule" />}
            </View>
          </View>

          {meeple.messages.map((msg) => (
            <View key={msg.id}>
              <ChatBubble message={msg} senderName={meeple.name} />
              {msg.sources && (
                <View style={styles.sources}>
                  {msg.sources.map((s) => (
                    <Pressable
                      key={s.url}
                      accessibilityRole="link"
                      accessibilityLabel={`Source: ${s.title}`}
                      onPress={() => Linking.openURL(s.url)}
                      style={({ pressed }) => [
                        styles.source,
                        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <FontAwesome name="link" size={10} color={theme.colors.textTertiary} {...decorative} />
                      <Text style={[styles.sourceText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {host(s.url)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {msg.actions?.length ? (
                <View style={styles.actions}>
                  {msg.actions.map((action, idx) => (
                    <ActionConfirmCard
                      key={idx}
                      action={action}
                      status={msg.actionStatuses?.[idx]}
                      onAccept={(a) => {
                        applyChatAction(a);
                        setActionStatus(meeple.id, msg.id, idx, 'accepted');
                      }}
                      onReject={() => setActionStatus(meeple.id, msg.id, idx, 'rejected')}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}

          {working && (
            <View style={styles.working} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={theme.colors.textSecondary} />
              <Text style={[styles.workingText, { color: theme.colors.textSecondary }]}>
                {meeple.name} is on it{meeple.webSearch ? ' — this can take a minute' : ''}…
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={{ paddingBottom: insets.bottom, backgroundColor: theme.colors.surface }}>
          <ChatInput onSend={(text) => sendToMeeple(meeple.id, text)} disabled={working} placeholder={`Give ${meeple.name} a task…`} />
        </View>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

function Skill({ icon, label }: { icon: 'globe' | 'calendar'; label: string }) {
  const { theme } = useThemeStore();
  return (
    <View style={[styles.skill, { borderColor: theme.colors.border }]}>
      <FontAwesome name={icon} size={11} color={theme.colors.textSecondary} {...decorative} />
      <Text style={[styles.skillText, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 16 },
  intro: { alignItems: 'center', paddingTop: 12, paddingBottom: 24, gap: 8 },
  role: { fontSize: 20, fontWeight: '500', marginTop: 6 },
  brief: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  skill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1,
  },
  skillText: { fontSize: 12 },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, marginBottom: 10 },
  source: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 200,
    paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1,
  },
  sourceText: { fontSize: 12 },
  actions: { paddingHorizontal: 12, marginTop: 4, marginBottom: 8 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  workingText: { fontSize: 14 },
});
