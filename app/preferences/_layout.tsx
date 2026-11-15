import { Stack } from 'expo-router';

/** Settings sub-pages, pushed over the tabs from the Settings tab. */
export default function PreferencesLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
