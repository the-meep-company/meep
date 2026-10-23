import { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { speak, stopSpeaking, isSpeaking } from '@/lib/tts';
import { useReduceMotion, hitSlopFor } from '@/lib/accessibility';
import type { ChatMessage } from '@/types';

interface ChatBubbleProps {
  message: ChatMessage;
  speakingMessageId?: string | null;
  onSpeakStart?: (id: string) => void;
  onSpeakEnd?: () => void;
}

export default function ChatBubble({
  message,
  speakingMessageId,
  onSpeakStart,
  onSpeakEnd,
}: ChatBubbleProps) {
  const { theme } = useThemeStore();
  const { aiPersona, ttsEnabled, ttsVoice, voiceLocale, companionName } = useSettingsStore();
  const reduceMotion = useReduceMotion();
  const isUser = message.role === 'user';
  const isSpeakingThis = speakingMessageId === message.id;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Reduce Motion: skip the pulse; the highlighted border still marks the speaking bubble
    if (isSpeakingThis && !reduceMotion) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [isSpeakingThis, reduceMotion]);

  const handleSpeak = async () => {
    const currentlySpeaking = await isSpeaking();
    if (currentlySpeaking && isSpeakingThis) {
      stopSpeaking();
      onSpeakEnd?.();
      return;
    }
    if (currentlySpeaking) {
      stopSpeaking();
    }
    onSpeakStart?.(message.id);
    speak(message.content, aiPersona, {
      voice: ttsVoice ?? undefined,
      language: voiceLocale,
    });
    // Poll until done then notify parent
    const poll = setInterval(async () => {
      const still = await isSpeaking();
      if (!still) {
        clearInterval(poll);
        onSpeakEnd?.();
      }
    }, 300);
  };

  const timeLabel = format(new Date(message.timestamp), 'h:mm a');

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            maxWidth: '80%',
            transform: [{ scale: pulseAnim }],
            borderWidth: isSpeakingThis ? 1.5 : 0,
            borderColor: isSpeakingThis ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {/* Sender + time + message read as one element; the timestamp below is hidden to avoid repeating it */}
        <Text
          accessibilityLabel={`${isUser ? 'You' : companionName || 'Meep'}, ${timeLabel}: ${message.content}`}
          style={[
            styles.text,
            { color: isUser ? theme.colors.onPrimary : theme.colors.text },
          ]}
        >
          {message.content}
        </Text>
        <View style={styles.footer}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[
              styles.time,
              isUser
                ? { color: theme.colors.onPrimary, opacity: 0.6 }
                : { color: theme.colors.textTertiary },
            ]}
          >
            {timeLabel}
          </Text>
          {!isUser && ttsEnabled && (
            <TouchableOpacity
              onPress={handleSpeak}
              style={styles.speakButton}
              hitSlop={hitSlopFor(18)}
              accessibilityRole="button"
              accessibilityLabel={isSpeakingThis ? 'Stop reading aloud' : 'Read message aloud'}
            >
              <FontAwesome
                name={isSpeakingThis ? 'stop-circle' : 'volume-up'}
                size={14}
                color={isSpeakingThis ? theme.colors.primary : theme.colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    padding: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 8,
  },
  time: {
    fontSize: 11,
  },
  speakButton: {
    padding: 2,
  },
});
