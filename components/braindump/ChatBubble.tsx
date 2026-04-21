import { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { speak, stopSpeaking, isSpeaking } from '@/lib/tts';
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
  const { aiPersona, ttsEnabled, ttsVoice, voiceLocale } = useSettingsStore();
  const isUser = message.role === 'user';
  const isSpeakingThis = speakingMessageId === message.id;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isSpeakingThis) {
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
  }, [isSpeakingThis]);

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
        <Text
          style={[
            styles.text,
            { color: isUser ? '#FFF' : theme.colors.text },
          ]}
        >
          {message.content}
        </Text>
        <View style={styles.footer}>
          <Text
            style={[
              styles.time,
              { color: isUser ? 'rgba(255,255,255,0.6)' : theme.colors.textTertiary },
            ]}
          >
            {format(new Date(message.timestamp), 'h:mm a')}
          </Text>
          {!isUser && ttsEnabled && (
            <TouchableOpacity
              onPress={handleSpeak}
              style={styles.speakButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
