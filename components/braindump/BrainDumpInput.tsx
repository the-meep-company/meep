import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

interface BrainDumpInputProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

export default function BrainDumpInput({ onSubmit, isProcessing }: BrainDumpInputProps) {
  const { theme } = useThemeStore();
  const [text, setText] = useState('');
  const [quickMode, setQuickMode] = useState(false);

  const handleSubmit = () => {
    if (!text.trim() || isProcessing) return;
    onSubmit(text.trim());
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          onPress={() => setQuickMode(false)}
          style={[
            styles.modeButton,
            {
              backgroundColor: !quickMode ? theme.colors.primary : theme.colors.surface,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.modeText, { color: !quickMode ? '#FFF' : theme.colors.textSecondary }]}>
            Brain Dump
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setQuickMode(true)}
          style={[
            styles.modeButton,
            {
              backgroundColor: quickMode ? theme.colors.primary : theme.colors.surface,
              borderRadius: theme.borderRadius.md,
            },
          ]}
        >
          <Text style={[styles.modeText, { color: quickMode ? '#FFF' : theme.colors.textSecondary }]}>
            Quick Add
          </Text>
        </TouchableOpacity>
      </View>

      {/* Text input */}
      <TextInput
        style={[
          quickMode ? styles.quickInput : styles.dumpInput,
          {
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            borderColor: theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        placeholder={
          quickMode
            ? 'Add: dentist at 3pm tomorrow'
            : "What's on your mind? Dump everything here...\n\nExample:\ndentist tuesday 2pm\nbuy groceries by friday\nmeditate every morning\nlearn to cook"
        }
        placeholderTextColor={theme.colors.textTertiary}
        value={text}
        onChangeText={setText}
        multiline={!quickMode}
        textAlignVertical="top"
        autoFocus
      />

      {/* Character count */}
      {!quickMode && text.length > 0 && (
        <Text style={[styles.charCount, { color: theme.colors.textTertiary }]}>
          {text.length} characters
        </Text>
      )}

      {/* Submit button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!text.trim() || isProcessing}
        style={[
          styles.submitButton,
          {
            backgroundColor: text.trim() && !isProcessing
              ? theme.colors.primary
              : theme.colors.surface,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text
            style={[
              styles.submitText,
              { color: text.trim() ? '#FFF' : theme.colors.textTertiary },
            ]}
          >
            {quickMode ? 'Add' : 'Process'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dumpInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
  },
  quickInput: {
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    height: 56,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  submitButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
