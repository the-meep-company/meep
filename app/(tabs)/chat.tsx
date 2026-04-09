import { StyleSheet, View, Text } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export default function ChatScreen() {
  const { theme } = useThemeStore();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Chat</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Talk to your AI companion
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
});
