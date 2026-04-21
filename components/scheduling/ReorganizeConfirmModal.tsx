import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import type { ReorganizePlacement, Task } from '@/types';

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'P1', color: '#EF4444' },
  2: { label: 'P2', color: '#F59E0B' },
  3: { label: 'P3', color: '#2563EB' },
  4: { label: 'P4', color: '#9CA3AF' },
};

const fmtRange = (s: Date, e: Date) =>
  `${format(new Date(s), 'EEE MMM d, h:mm a')} – ${format(new Date(e), 'h:mm a')}`;

interface ReorganizeConfirmModalProps {
  visible: boolean;
  placements: ReorganizePlacement[];
  unplaceable: { task: Task; reason: string }[];
  onAccept: (placement: ReorganizePlacement) => void;
  onReject: (taskId: string) => void;
  onAcceptAll: () => void;
  onClose: () => void;
}

export default function ReorganizeConfirmModal({
  visible,
  placements,
  unplaceable,
  onAccept,
  onReject,
  onAcceptAll,
  onClose,
}: ReorganizeConfirmModalProps) {
  const { theme } = useThemeStore();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const handleAccept = (placement: ReorganizePlacement) => {
    setAccepted((prev) => new Set(prev).add(placement.task.id));
    setRejected((prev) => {
      const next = new Set(prev);
      next.delete(placement.task.id);
      return next;
    });
    onAccept(placement);
  };

  const handleReject = (taskId: string) => {
    setRejected((prev) => new Set(prev).add(taskId));
    onReject(taskId);
  };

  const handleAcceptAll = () => {
    setAccepted(new Set(placements.map((p) => p.task.id)));
    onAcceptAll();
  };

  const handleClose = () => {
    setAccepted(new Set());
    setRejected(new Set());
    onClose();
  };

  const pendingCount = placements.filter(
    (p) => !accepted.has(p.task.id) && !rejected.has(p.task.id)
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
              <FontAwesome name="refresh" size={18} color={theme.colors.primary} />
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Your day was reorganized
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
              const isAccepted = accepted.has(placement.task.id);
              const isRejected = rejected.has(placement.task.id);
              const priority = PRIORITY_LABELS[placement.task.priority] ?? PRIORITY_LABELS[3];

              return (
                <View
                  key={placement.task.id}
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

                  {/* Old time — muted */}
                  <View style={styles.timeRow}>
                    <FontAwesome name="clock-o" size={12} color={theme.colors.textTertiary} />
                    <Text style={[styles.oldTimeText, { color: theme.colors.textTertiary }]}>
                      {fmtRange(placement.oldStart, placement.oldEnd)}
                    </Text>
                  </View>

                  {/* New time — primary */}
                  <View style={styles.timeRow}>
                    <FontAwesome name="arrow-right" size={11} color={theme.colors.primary} />
                    <Text style={[styles.newTimeText, { color: theme.colors.primary }]}>
                      {fmtRange(placement.newStart, placement.newEnd)}
                    </Text>
                  </View>

                  <Text style={[styles.reasonText, { color: theme.colors.textSecondary }]}>
                    {placement.reason}
                  </Text>

                  {/* Action buttons */}
                  {isAccepted ? (
                    <View style={[styles.rescheduledBadge, { backgroundColor: '#10B98120' }]}>
                      <FontAwesome name="check" size={12} color="#10B981" />
                      <Text style={[styles.rescheduledText, { color: '#10B981' }]}>Rescheduled</Text>
                    </View>
                  ) : !isRejected ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => handleReject(placement.task.id)}
                        style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}
                      >
                        <FontAwesome name="times" size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleAccept(placement)}
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
                  Could not reschedule
                </Text>
                {unplaceable.map((item) => (
                  <View
                    key={item.task.id}
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
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
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
    marginBottom: 8,
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
  oldTimeText: {
    fontSize: 12,
  },
  newTimeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 12,
    marginTop: 2,
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
  rescheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rescheduledText: {
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
