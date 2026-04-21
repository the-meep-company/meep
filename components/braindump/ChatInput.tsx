import { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const { theme } = useThemeStore();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        placeholder={placeholder || 'Make corrections...'}
        placeholderTextColor={theme.colors.textTertiary}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        editable={!disabled}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        style={[
          styles.sendButton,
          {
            backgroundColor: text.trim() ? theme.colors.primary : 'transparent',
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        <FontAwesome
          name="send"
          size={16}
          color={text.trim() ? '#FFF' : theme.colors.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
