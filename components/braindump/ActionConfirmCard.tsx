import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import type { ChatAction } from '@/types';

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: 'calendar' | 'check' | 'trash-o' | 'arrows' | 'plus' }> = {
  create_event: { label: 'Create Event', color: '#2563EB', icon: 'plus' },
  move_event: { label: 'Move Event', color: '#2563EB', icon: 'arrows' },
  delete_event: { label: 'Delete Event', color: '#EF4444', icon: 'trash-o' },
  create_task: { label: 'Create Task', color: '#10B981', icon: 'plus' },
  complete_task: { label: 'Complete Task', color: '#10B981', icon: 'check' },
};

interface ActionConfirmCardProps {
  action: ChatAction;
  onAccept: (action: ChatAction) => void;
  onReject: (action: ChatAction) => void;
  status?: 'accepted' | 'rejected';
}

export default function ActionConfirmCard({ action, onAccept, onReject, status }: ActionConfirmCardProps) {
  const { theme } = useThemeStore();
  const config = ACTION_CONFIG[action.type] || { label: action.type, color: '#6C5CE7', icon: 'calendar' as const };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          borderLeftColor: config.color,
          opacity: status ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: config.color + '22' }]}>
          <FontAwesome name={config.icon} size={10} color={config.color} />
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <Text style={[styles.label, { color: theme.colors.text }]} numberOfLines={2}>
        {action.label}
      </Text>

      {!status && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => onReject(action)}
            style={[styles.rejectButton, { borderColor: theme.colors.border }]}
          >
            <FontAwesome name="times" size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAccept(action)}
            style={[styles.acceptButton, { backgroundColor: config.color }]}
          >
            <FontAwesome name="check" size={12} color="#FFF" />
            <Text style={[styles.buttonText, { color: '#FFF' }]}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {status && (
        <View style={styles.statusBadge}>
          <FontAwesome
            name={status === 'accepted' ? 'check-circle' : 'times-circle'}
            size={14}
            color={status === 'accepted' ? (theme.colors.success || '#10B981') : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.statusText,
              { color: status === 'accepted' ? (theme.colors.success || '#10B981') : theme.colors.textSecondary },
            ]}
          >
            {status === 'accepted' ? 'Accepted' : 'Rejected'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
