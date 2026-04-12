import { StyleSheet, View, Text } from 'react-native';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import type { ChatMessage } from '@/types';

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const { theme } = useThemeStore();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            maxWidth: '80%',
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
        <Text
          style={[
            styles.time,
            { color: isUser ? 'rgba(255,255,255,0.6)' : theme.colors.textTertiary },
          ]}
        >
          {format(new Date(message.timestamp), 'h:mm a')}
        </Text>
      </View>
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
  time: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
