import { AppState } from 'react-native';
import { useCalendarStore } from '@/stores/calendarStore';
import { useTaskStore } from '@/stores/taskStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { writeWidgetPayload } from '@/lib/widgetData';

let initialized = false;
let timeoutRef: ReturnType<typeof setTimeout> | null = null;

function schedulePayloadWrite() {
  if (timeoutRef) clearTimeout(timeoutRef);
  timeoutRef = setTimeout(() => {
    writeWidgetPayload().catch((err) => {
      console.warn('[widgetSync] Failed to write widget payload.', err);
    });
  }, 300);
}

export function initializeWidgetSync(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const unsubCalendar = useCalendarStore.subscribe(() => schedulePayloadWrite());
  const unsubTasks = useTaskStore.subscribe(() => schedulePayloadWrite());
  const unsubSettings = useSettingsStore.subscribe(() => schedulePayloadWrite());

  const appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') {
      schedulePayloadWrite();
    }
  });

  schedulePayloadWrite();

  return () => {
    unsubCalendar();
    unsubTasks();
    unsubSettings();
    appStateSub.remove();
    if (timeoutRef) clearTimeout(timeoutRef);
    timeoutRef = null;
    initialized = false;
  };
}
