import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';

/** Which tasks the home screen widget shows. */
export default function WidgetScreen() {
  const { widgetCategory, setWidgetCategory } = useSettingsStore();
  const tasks = useTaskStore((s) => s.tasks);

  const categories = Array.from(
    new Set(tasks.map((t) => t.category).filter((c): c is string => Boolean(c)))
  ).sort();
  // Keep a chosen category selectable even once its last task is gone.
  if (widgetCategory && !categories.includes(widgetCategory)) categories.unshift(widgetCategory);

  return (
    <SettingsPage title="Widget tasks">
      <SettingsSection
        footer={
          categories.length === 0
            ? 'Add categories to your tasks to show just one of them on the widget.'
            : 'The home screen widget shows tasks from the category you pick.'
        }
      >
        <SettingsGroup accessibilityRole="radiogroup" accessibilityLabel="Tasks shown on the widget">
          <SettingsRow
            kind="radio"
            testID="widget-all"
            title="All tasks"
            selected={widgetCategory === null}
            onPress={() => setWidgetCategory(null)}
          />
          {categories.map((category) => (
            <SettingsRow
              key={category}
              kind="radio"
              title={category}
              selected={widgetCategory === category}
              onPress={() => setWidgetCategory(category)}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
