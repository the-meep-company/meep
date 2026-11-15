import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ActivityIndicator, AccessibilityInfo,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { a11yState, decorative } from '@/lib/accessibility';
import VoiceInput from '@/components/braindump/VoiceInput';
import PillTabs from '@/components/ui/PillTabs';
import { useSurfaceStyle } from '@/components/ui/surface';
import { SurfaceGlass } from '@/components/common/GlassCard';

interface BrainDumpInputProps {
  onSubmit: (text: string) => void;
  /** When set, adds an "Ask" mode that sends the text as a question instead of parsing it. */
  onAsk?: (text: string) => void;
  isProcessing: boolean;
  /** Bots that can be addressed with "@name" or a card's Reply. */
  bots?: { id: string; name: string }[];
  /** The bot the next message goes to, if any. */
  target?: { id: string; name: string } | null;
  onTargetChange?: (id: string | null) => void;
  onSendToBot?: (botId: string, text: string) => void;
}

/** The bot whose name the text starts with after "@" (longest name wins), and the rest. */
function matchMention(text: string, bots: { id: string; name: string }[]) {
  if (!text.startsWith('@')) return null;
  const rest = text.slice(1).toLowerCase();
  const bot = [...bots]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => rest.startsWith(b.name.toLowerCase()));
  return bot ? { bot, message: text.slice(1 + bot.name.length).trim() } : null;
}

type Mode = 'dump' | 'quick' | 'ask';

export default function BrainDumpInput({
  onSubmit,
  onAsk,
  isProcessing,
  bots = [],
  target,
  onTargetChange,
  onSendToBot,
}: BrainDumpInputProps) {
  const { theme } = useThemeStore();
  const surface = useSurfaceStyle('strong');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('dump');
  const quickMode = mode === 'quick';
  const askMode = mode === 'ask';
  // Quick add and Ask are one-liners that send on return
  const oneLine = quickMode || askMode || !!target;
  const send = (value: string) => {
    // Talking to a bot: a card's Reply, or "@Name message" in any mode.
    const mention = onSendToBot ? matchMention(value, bots) : null;
    if (onSendToBot && (target || mention)) {
      const botId = target?.id ?? mention!.bot.id;
      const message = target ? value : mention!.message;
      if (!message) return;
      onSendToBot(botId, message);
      setText('');
      onTargetChange?.(null);
      return;
    }
    if (askMode && onAsk) onAsk(value);
    else onSubmit(value);
  };
  // "@" at the start offers the bots whose names match what's typed so far.
  const mentionQuery = !target && text.startsWith('@') && !matchMention(text, bots) ? text.slice(1).toLowerCase() : null;
  const suggestions =
    mentionQuery != null && onTargetChange
      ? bots.filter((b) => b.name.toLowerCase().startsWith(mentionQuery)).slice(0, 4)
      : [];
  // Captures whatever was typed before voice started so we can prepend it correctly
  const textBeforeVoice = useRef('');
  const voiceSessionActive = useRef(false);

  // Spinner replaces the button label, so tell screen-reader users work has started
  useEffect(() => {
    if (isProcessing) AccessibilityInfo.announceForAccessibility('Processing…');
  }, [isProcessing]);

  const handleSubmit = () => {
    if (!text.trim() || isProcessing) return;
    send(text.trim());
  };

  const handleTranscription = (transcript: string) => {
    const prefix = textBeforeVoice.current;
    const updated = oneLine
      ? transcript
      : prefix ? `${prefix}\n${transcript}` : transcript;
    setText(updated);
    textBeforeVoice.current = '';
    voiceSessionActive.current = false;
    if (oneLine) {
      send(updated.trim());
    }
  };

  // Shows live transcription in the text field as the user speaks
  const handleInterim = (interim: string) => {
    // Save pre-voice text on the first interim event of each session
    if (!voiceSessionActive.current) {
      textBeforeVoice.current = text;
      voiceSessionActive.current = true;
    }
    const prefix = textBeforeVoice.current;
    setText(prefix ? `${prefix}\n${interim}` : interim);
  };

  const canSubmit = !!text.trim() && !isProcessing;

  return (
    <View style={styles.container}>
      {target ? (
        <View style={styles.targetRow}>
          <View style={[styles.targetChip, surface]}>
            <SurfaceGlass radius={19} />
            <FontAwesome name="reply" size={11} color={theme.colors.textSecondary} {...decorative} />
            <Text style={[styles.targetText, { color: theme.colors.text }]} numberOfLines={1}>
              To {target.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Stop replying to ${target.name}`}
              hitSlop={10}
              onPress={() => onTargetChange?.(null)}
            >
              <FontAwesome name="times" size={12} color={theme.colors.textTertiary} />
            </Pressable>
          </View>
        </View>
      ) : suggestions.length ? (
        <View style={styles.targetRow} accessibilityRole="menu" accessibilityLabel="Bots">
          {suggestions.map((b) => (
            <Pressable
              key={b.id}
              accessibilityRole="menuitem"
              accessibilityLabel={`Talk to ${b.name}`}
              onPress={() => {
                onTargetChange?.(b.id);
                setText('');
              }}
              style={({ pressed }) => [styles.targetChip, surface, pressed && { opacity: 0.75 }]}
            >
              <SurfaceGlass radius={19} />
              <Text style={[styles.targetText, { color: theme.colors.text }]}>@{b.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <PillTabs
          options={[
            { value: 'dump', label: 'Brain dump' },
            { value: 'quick', label: 'Quick add' },
            ...(onAsk ? [{ value: 'ask' as const, label: 'Ask' }] : []),
          ]}
          value={mode}
          onChange={setMode}
          accessibilityLabel="Input mode"
          style={styles.modes}
        />
      )}

      {/* Composer: a pill field with the send button inside, mic alongside */}
      <View style={styles.composerRow}>
        <View style={[styles.field, surface]}>
          <SurfaceGlass radius={FIELD / 2} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder={
              target
                ? `Reply to ${target.name}…`
                : askMode
                ? 'Ask about your day, or @ a bot…'
                : quickMode
                ? 'Add: dentist at 3pm tomorrow'
                : 'Dump it all here…'
            }
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel={target ? `Reply to ${target.name}` : askMode ? 'Ask' : quickMode ? 'Quick add' : 'Brain dump'}
            accessibilityHint={
              askMode
                ? 'Ask about your schedule, tasks, or anything else'
                : quickMode
                ? 'Describe one item, for example dentist at 3pm tomorrow'
                : 'Type everything on your mind, one thing per line'
            }
            returnKeyType={askMode || target ? 'send' : quickMode ? 'done' : 'default'}
            onSubmitEditing={oneLine ? handleSubmit : undefined}
            value={text}
            onChangeText={setText}
            multiline={!oneLine}
            numberOfLines={1}
            textAlignVertical="center"
          />
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={target ? `Send to ${target.name}` : askMode ? 'Ask' : quickMode ? 'Add' : 'Process brain dump'}
            {...a11yState({ disabled: !canSubmit, busy: isProcessing })}
            style={({ pressed }) => [
              styles.send,
              canSubmit
                ? { backgroundColor: theme.colors.primary }
                : { backgroundColor: theme.colors.primaryLight },
              pressed && { opacity: 0.8 },
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator color={theme.colors.text} size="small" />
            ) : (
              <FontAwesome
                name="arrow-up"
                size={16}
                color={canSubmit ? theme.colors.onPrimary : theme.colors.textTertiary}
              />
            )}
          </Pressable>
        </View>

        <VoiceInput
          size={FIELD}
          onTranscription={handleTranscription}
          onInterim={handleInterim}
          disabled={isProcessing}
        />
      </View>
    </View>
  );
}

const FIELD = 56;

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  modes: {
    alignSelf: 'flex-start',
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  targetText: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  field: {
    flex: 1,
    minHeight: FIELD,
    borderRadius: FIELD / 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 22,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    maxHeight: 160,
    minHeight: 44,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 11,
    paddingBottom: 11,
    paddingRight: 8,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
