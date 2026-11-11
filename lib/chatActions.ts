import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import type { ChatAction } from '@/types';

const newId = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);

/** Carries out an action the AI proposed, once the user has accepted it. */
export function applyChatAction(action: ChatAction) {
  const now = new Date();
  switch (action.type) {
    case 'create_event':
      useCalendarStore.getState().addEvent({
        id: newId(),
        title: action.params.title,
        startTime: new Date(action.params.startTime),
        endTime: new Date(action.params.endTime),
        description: action.params.description,
        allDay: action.params.allDay ?? false,
        color: action.params.color ?? '#2563EB',
        source: 'local',
        createdAt: now,
        updatedAt: now,
      });
      break;
    case 'move_event':
      useCalendarStore.getState().updateEvent(action.params.eventId, {
        startTime: new Date(action.params.newStartTime),
        endTime: new Date(action.params.newEndTime),
      });
      break;
    case 'delete_event':
      useCalendarStore.getState().deleteEvent(action.params.eventId);
      break;
    case 'complete_task':
      useTaskStore.getState().toggleStatus(action.params.taskId);
      break;
    case 'create_task':
      useTaskStore.getState().addTask({
        id: newId(),
        title: action.params.title,
        priority: action.params.priority ?? 3,
        status: 'todo',
        description: action.params.description,
        dueDate: action.params.dueDate ? new Date(action.params.dueDate) : undefined,
        estimatedMinutes: action.params.estimatedMinutes,
        createdAt: now,
        updatedAt: now,
      });
      break;
  }
}
