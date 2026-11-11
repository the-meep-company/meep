import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, TextInput, Pressable, ActivityIndicator, AccessibilityInfo,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { a11yState } from '@/lib/accessibility';
import VoiceInput from '@/components/braindump/VoiceInput';
import PillTabs from '@/components/ui/PillTabs';
import { useSurfaceStyle } from '@/components/ui/surface';
import { SurfaceGlass } from '@/components/common/GlassCard';

interface BrainDumpInputProps {
  onSubmit: (text: string) => void;
  /** When set, adds an "Ask" mode that sends the text as a question instead of parsing it. */
  onAsk?: (text: string) => void;
  isProcessing: boolean;
}

type Mode = 'dump' | 'quick' | 'ask';

export default function BrainDumpInput({ onSubmit, onAsk, isProcessing }: BrainDumpInputProps) {
  const { theme } = useThemeStore();
  const surface = useSurfaceStyle('strong');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('dump');
  const quickMode = mode === 'quick';
  const askMode = mode === 'ask';
  // Quick add and Ask are one-liners that send on return
  const oneLine = quickMode || askMode;
  const send = (value: string) => (askMode && onAsk ? onAsk(value) : onSubmit(value));
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

      {/* Composer: a pill field with the send button inside, mic alongside */}
      <View style={styles.composerRow}>
        <View style={[styles.field, surface]}>
          <SurfaceGlass radius={FIELD / 2} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder={askMode ? 'Ask about your day…' : quickMode ? 'Add: dentist at 3pm tomorrow' : 'Dump it all here…'}
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel={askMode ? 'Ask' : quickMode ? 'Quick add' : 'Brain dump'}
            accessibilityHint={
              askMode
                ? 'Ask about your schedule, tasks, or anything else'
                : quickMode
                ? 'Describe one item, for example dentist at 3pm tomorrow'
                : 'Type everything on your mind, one thing per line'
            }
            returnKeyType={askMode ? 'send' : quickMode ? 'done' : 'default'}
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
            accessibilityLabel={askMode ? 'Ask' : quickMode ? 'Add' : 'Process brain dump'}
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
