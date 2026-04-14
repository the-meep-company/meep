import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import * as voice from '@/lib/voice';

type VoiceState = 'idle' | 'recording' | 'processing';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  onInterim?: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscription, onInterim, disabled = false }: VoiceInputProps) {
  const { theme } = useThemeStore();
  const { voiceLocale } = useSettingsStore();
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [supported, setSupported] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate the button background opacity to pulse while recording
  const bgOpacity = useSharedValue(0.15);

  const animatedBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 82, 82, ${bgOpacity.value})`,
  }));

  const startPulse = () => {
    bgOpacity.value = withRepeat(
      withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  };

  const stopPulse = () => {
    cancelAnimation(bgOpacity);
    bgOpacity.value = withTiming(0.15, { duration: 200 });
  };

  const showError = (msg: string) => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setErrorMsg(msg);
    errorTimer.current = setTimeout(() => setErrorMsg(null), 3000);
  };

  useEffect(() => {
    setSupported(voice.isSupported());

    voice.onResult((text) => {
      setVoiceState('processing');
      onTranscription(text);
      setVoiceState('idle');
      stopPulse();
    });

    voice.onInterim((text) => {
      onInterim?.(text);
    });

    voice.onError((err) => {
      setVoiceState('idle');
      stopPulse();
      if (err.includes('denied') || err.includes('not-allowed')) {
        showError('Microphone blocked. Allow access in your browser settings.');
      } else if (err.includes('No speech')) {
        showError('No speech detected. Try again.');
      } else {
        showError(err);
      }
    });

    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  const handlePress = () => {
    if (disabled || !supported) return;
    setErrorMsg(null);

    if (voiceState === 'recording') {
      voice.stopListening();
      setVoiceState('processing');
      stopPulse();
    } else if (voiceState === 'idle') {
      voice.startListening(voiceLocale);
      setVoiceState('recording');
      startPulse();
    }
  };

  if (!supported) return null;

  const isRecording = voiceState === 'recording';
  const isProcessing = voiceState === 'processing';

  const borderColor = isRecording
    ? theme.colors.error
    : disabled
    ? theme.colors.textTertiary
    : theme.colors.primary;

  const iconColor = isRecording ? theme.colors.error : borderColor;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || isProcessing}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start voice input'}
        style={[
          styles.button,
          {
            borderColor,
            borderRadius: theme.borderRadius.full,
            // Static base background
            backgroundColor: isRecording ? undefined : theme.colors.surface,
          },
        ]}
      >
        {/* Pulsing background layer — contained inside the button */}
        {isRecording && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: theme.borderRadius.full },
              animatedBgStyle,
            ]}
          />
        )}

        {isProcessing ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <FontAwesome
            name={isRecording ? 'stop' : 'microphone'}
            size={18}
            color={iconColor}
          />
        )}
      </TouchableOpacity>

      {errorMsg && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {errorMsg}
        </Text>
      )}
    </View>
  );
}

const SIZE = 48;

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden', // clips the animated bg to the circle
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    maxWidth: 200,
  },
});
