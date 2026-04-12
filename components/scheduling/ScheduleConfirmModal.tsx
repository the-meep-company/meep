import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import type { SchedulePlacement, Task, TaskPriority } from '@/types';

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'P1', color: '#EF4444' },
  2: { label: 'P2', color: '#F59E0B' },
  3: { label: 'P3', color: '#2563EB' },
  4: { label: 'P4', color: '#9CA3AF' },
};

interface ScheduleConfirmModalProps {
  visible: boolean;
  placements: SchedulePlacement[];
  unplaceable: { taskId: string; task: Task; reason: string }[];
  onAccept: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onAcceptAll: () => void;
  onClose: () => void;
}

export default function ScheduleConfirmModal({
  visible,
  placements,
  unplaceable,
  onAccept,
  onReject,
  onAcceptAll,
  onClose,
}: ScheduleConfirmModalProps) {
  const { theme } = useThemeStore();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const handleAccept = (taskId: string) => {
    setAccepted((prev) => new Set(prev).add(taskId));
    setRejected((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    onAccept(taskId);
  };

  const handleReject = (taskId: string) => {
    setRejected((prev) => new Set(prev).add(taskId));
    onReject(taskId);
  };

  const handleAcceptAll = () => {
    const allIds = new Set(placements.map((p) => p.taskId));
    setAccepted(allIds);
    onAcceptAll();
  };

  const handleClose = () => {
    setAccepted(new Set());
    setRejected(new Set());
    onClose();
  };

  const pendingCount = placements.filter(
    (p) => !accepted.has(p.taskId) && !rejected.has(p.taskId)
  ).length;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.borderRadius.lg,
              borderTopRightRadius: theme.borderRadius.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <FontAwesome name="magic" size={18} color={theme.colors.primary} />
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Smart Schedule
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome name="times" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Accept All button */}
          {pendingCount > 0 && (
            <TouchableOpacity
              onPress={handleAcceptAll}
              style={[
                styles.acceptAllButton,
                { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md },
              ]}
            >
              <Text style={styles.acceptAllText}>Accept All ({pendingCount})</Text>
            </TouchableOpacity>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {/* Placement cards */}
            {placements.map((placement) => {
              const isAccepted = accepted.has(placement.taskId);
              const isRejected = rejected.has(placement.taskId);
              const priority = PRIORITY_LABELS[placement.task.priority] ?? PRIORITY_LABELS[3];
              const startStr = format(new Date(placement.proposedStart), 'EEE MMM d, h:mm a');
              const endStr = format(new Date(placement.proposedEnd), 'h:mm a');

              return (
                <View
                  key={placement.taskId}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.borderRadius.md,
                      opacity: isRejected ? 0.4 : 1,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      style={[styles.cardTitle, { color: theme.colors.text }]}
                      numberOfLines={1}
                    >
                      {placement.task.title}
                    </Text>
                    <View style={[styles.priorityBadge, { backgroundColor: priority.color + '20' }]}>
                      <Text style={[styles.priorityText, { color: priority.color }]}>
                        {priority.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timeRow}>
                    <FontAwesome name="clock-o" size={12} color={theme.colors.textSecondary} />
                    <Text style={[styles.timeText, { color: theme.colors.text }]}>
                      {startStr} – {endStr}
                    </Text>
                  </View>

                  <Text style={[styles.reasonText, { color: theme.colors.textSecondary }]}>
                    {placement.reason}
                  </Text>

                  {/* Action buttons */}
                  {isAccepted ? (
                    <View style={[styles.scheduledBadge, { backgroundColor: '#10B98120' }]}>
                      <FontAwesome name="check" size={12} color="#10B981" />
                      <Text style={[styles.scheduledText, { color: '#10B981' }]}>Scheduled</Text>
                    </View>
                  ) : !isRejected ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => handleReject(placement.taskId)}
                        style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}
                      >
                        <FontAwesome name="times" size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleAccept(placement.taskId)}
                        style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                      >
                        <FontAwesome name="check" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* Unplaceable section */}
            {unplaceable.length > 0 && (
              <View style={styles.unplaceableSection}>
                <Text style={[styles.unplaceableTitle, { color: theme.colors.textSecondary }]}>
                  Could not schedule
                </Text>
                {unplaceable.map((item) => (
                  <View
                    key={item.taskId}
                    style={[
                      styles.unplaceableCard,
                      { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.sm },
                    ]}
                  >
                    <Text style={[styles.unplaceableName, { color: theme.colors.text }]}>
                      {item.task.title}
                    </Text>
                    <Text style={[styles.unplaceableReason, { color: theme.colors.textTertiary }]}>
                      {item.reason}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    maxHeight: '80%',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  acceptAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptAllText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 12,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  scheduledText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unplaceableSection: {
    marginTop: 16,
  },
  unplaceableTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  unplaceableCard: {
    padding: 10,
    marginBottom: 6,
  },
  unplaceableName: {
    fontSize: 14,
    fontWeight: '500',
  },
  unplaceableReason: {
    fontSize: 12,
    marginTop: 2,
  },
});
