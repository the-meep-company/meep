import { useState } from 'react';
import { PRIORITY } from '@/lib/semanticColors';
import {
  StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, AccessibilityInfo, Platform,
} from 'react-native';

// VoiceOver doesn't follow live regions; Android/web get the badge's live region instead.
const announce = (msg: string) => {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(msg);
};
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { format } from 'date-fns';
import { useThemeStore } from '@/stores/themeStore';
import { useReduceMotion, decorative, hitSlopFor } from '@/lib/accessibility';
import type { SchedulePlacement, Task, TaskPriority } from '@/types';

const PRIORITY_LABELS = PRIORITY;

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
  const reduceMotion = useReduceMotion();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const handleAccept = (taskId: string) => {
    const title = placements.find((p) => p.taskId === taskId)?.task.title;
    announce(title ? `Scheduled ${title}` : 'Scheduled');
    setAccepted((prev) => new Set(prev).add(taskId));
    setRejected((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    onAccept(taskId);
  };

  const handleReject = (taskId: string) => {
    const title = placements.find((p) => p.taskId === taskId)?.task.title;
    announce(title ? `Rejected ${title}` : 'Rejected');
    setRejected((prev) => new Set(prev).add(taskId));
    onReject(taskId);
  };

  const handleAcceptAll = () => {
    const allIds = new Set(placements.map((p) => p.taskId));
    setAccepted(allIds);
    announce('All suggestions scheduled');
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
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View
          accessibilityViewIsModal
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
              <FontAwesome name="magic" size={18} color={theme.colors.primary} {...decorative} />
              <Text
                accessibilityRole="header"
                style={[styles.headerTitle, { color: theme.colors.text }]}
              >
                Smart Schedule
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={hitSlopFor(20)}
            >
              <FontAwesome name="times" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Accept All button */}
          {pendingCount > 0 && (
            <TouchableOpacity
              onPress={handleAcceptAll}
              accessibilityRole="button"
              accessibilityLabel={`Accept all ${pendingCount} ${pendingCount === 1 ? 'suggestion' : 'suggestions'}`}
              hitSlop={hitSlopFor(42)}
              style={[
                styles.acceptAllButton,
                { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md },
              ]}
            >
              <Text style={[styles.acceptAllText, { color: theme.colors.onPrimary }]}>
                Accept All ({pendingCount})
              </Text>
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
                      accessibilityLabel={
                        isRejected ? `${placement.task.title}, rejected` : placement.task.title
                      }
                    >
                      {placement.task.title}
                    </Text>
                    <View style={[styles.priorityBadge, { backgroundColor: priority.color + '20' }]}>
                      <Text
                        style={[styles.priorityText, { color: priority.color }]}
                        accessibilityLabel={`Priority ${placement.task.priority ?? 3}`}
                      >
                        {priority.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timeRow}>
                    <FontAwesome name="clock-o" size={12} color={theme.colors.textSecondary} {...decorative} />
                    <Text style={[styles.timeText, { color: theme.colors.text }]}>
                      {startStr} – {endStr}
                    </Text>
                  </View>

                  <Text style={[styles.reasonText, { color: theme.colors.textSecondary }]}>
                    {placement.reason}
                  </Text>

                  {/* Action buttons */}
                  {isAccepted ? (
                    <View
                      style={[styles.scheduledBadge, { backgroundColor: theme.colors.success + '20' }]}
                      accessibilityLiveRegion="polite"
                    >
                      <FontAwesome name="check" size={12} color={theme.colors.success} {...decorative} />
                      <Text style={[styles.scheduledText, { color: theme.colors.success }]}>Scheduled</Text>
                    </View>
                  ) : !isRejected ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        onPress={() => handleReject(placement.taskId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Reject proposed time for ${placement.task.title}`}
                        hitSlop={hitSlopFor(36)}
                        style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}
                      >
                        <FontAwesome name="times" size={14} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleAccept(placement.taskId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Accept proposed time for ${placement.task.title}`}
                        hitSlop={hitSlopFor(36)}
                        style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                      >
                        <FontAwesome name="check" size={14} color={theme.colors.onPrimary} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* Unplaceable section */}
            {unplaceable.length > 0 && (
              <View style={styles.unplaceableSection}>
                <Text
                  accessibilityRole="header"
                  style={[styles.unplaceableTitle, { color: theme.colors.textSecondary }]}
                >
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
