import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import type { ParsedItem } from '@/types';

const TYPE_CONFIG = {
  event: { label: 'Event', color: '#2563EB', icon: 'calendar' as const },
  task: { label: 'Task', color: '#10B981', icon: 'check' as const },
  goal: { label: 'Goal', color: '#8B5CF6', icon: 'flag' as const },
  habit: { label: 'Habit', color: '#F59E0B', icon: 'refresh' as const },
};

interface ParsedItemCardProps {
  item: ParsedItem;
  onEdit: (item: ParsedItem) => void;
  onDelete: (id: string) => void;
  onConfirm: (id: string) => void;
}

export default function ParsedItemCard({ item, onEdit, onDelete, onConfirm }: ParsedItemCardProps) {
  const { theme } = useThemeStore();
  const config = TYPE_CONFIG[item.type];

  if (item.status === 'deleted') return null;

  const getDetails = () => {
    switch (item.type) {
      case 'event': {
        const e = item.event;
        if (!e) return '';
        const parts: string[] = [];
        if (e.startTime) parts.push(format(new Date(e.startTime), 'MMM d, h:mm a'));
        if (e.location) parts.push(e.location);
        return parts.join(' · ');
      }
      case 'task': {
        const t = item.task;
        if (!t) return '';
        const parts: string[] = [];
        if (t.priority) parts.push(`P${t.priority}`);
        if (t.dueDate) parts.push(`Due ${format(new Date(t.dueDate), 'MMM d')}`);
        if (t.estimatedMinutes) parts.push(`${t.estimatedMinutes}min`);
        return parts.join(' · ');
      }
      case 'goal': {
        const g = item.goal;
        if (!g) return '';
        if (g.targetDate) return `Target: ${format(new Date(g.targetDate), 'MMM d')}`;
        if (g.category) return g.category;
        return '';
      }
      case 'habit': {
        const h = item.habit;
        if (!h) return '';
        const parts: string[] = [];
        parts.push(h.frequency || 'daily');
        if (h.startTime) parts.push(h.startTime);
        if (h.durationMinutes) parts.push(`${h.durationMinutes}min`);
        return parts.join(' · ');
      }
    }
  };

  const getTitle = () => {
    switch (item.type) {
      case 'event': return item.event?.title || item.raw;
      case 'task': return item.task?.title || item.raw;
      case 'goal': return item.goal?.title || item.raw;
      case 'habit': return item.habit?.title || item.raw;
    }
  };

  const isConfirmed = item.status === 'confirmed';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          borderLeftColor: config.color,
          opacity: isConfirmed ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        {/* Type badge */}
        <View style={[styles.badge, { backgroundColor: config.color + '22' }]}>
          <FontAwesome name={config.icon} size={10} color={config.color} />
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>

        {/* Confidence */}
        {item.confidence < 0.8 && (
          <Text style={[styles.confidence, { color: theme.colors.textTertiary }]}>
            {Math.round(item.confidence * 100)}%
          </Text>
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
        {getTitle()}
      </Text>

      {/* Details */}
      {getDetails() ? (
        <Text style={[styles.details, { color: theme.colors.textSecondary }]}>
          {getDetails()}
        </Text>
      ) : null}

      {/* Actions */}
      {!isConfirmed && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionButton}>
            <FontAwesome name="pencil" size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.actionButton}>
            <FontAwesome name="trash-o" size={14} color={theme.colors.error} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onConfirm(item.id)}
            style={[styles.confirmButton, { backgroundColor: config.color }]}
          >
            <FontAwesome name="check" size={12} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {isConfirmed && (
        <View style={styles.confirmedBadge}>
          <FontAwesome name="check-circle" size={14} color={theme.colors.success || '#10B981'} />
          <Text style={[styles.confirmedText, { color: theme.colors.success || '#10B981' }]}>
            Saved
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
    justifyContent: 'space-between',
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
  confidence: {
    fontSize: 11,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  details: {
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
  },
  confirmButton: {
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
