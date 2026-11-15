import { useRouter, type Href } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';
import SettingsPage from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow, SettingsSection } from '@/components/ui/Settings';
import { timeZoneCity, timeZoneOffset } from '@/lib/timezones';

/** Follow the device's time zone, or pick one by hand. */
export default function TimeZoneScreen() {
  const router = useRouter();
  const { timezone, timezoneAutoDetect, setTimezoneAutoDetect } = useSettingsStore();
  const offset = timeZoneOffset(timezone);
  const current = offset ? `${timeZoneCity(timezone)} (${offset})` : timeZoneCity(timezone);

  return (
    <SettingsPage title="Time zone">
      <SettingsSection footer="Used for scheduling, and for working out dates like “tomorrow at 9”.">
        <SettingsGroup>
          <SettingsRow
            kind="switch"
            testID="time-zone-auto"
            title="Set automatically"
            description={timezoneAutoDetect ? `Following this device: ${current}` : undefined}
            value={timezoneAutoDetect}
            onValueChange={setTimezoneAutoDetect}
          />
          {!timezoneAutoDetect && (
            <SettingsRow
              kind="button"
              testID="time-zone-pick"
              title="Time zone"
              value={current}
              onPress={() => router.push('/preferences/time-zone-picker' as Href)}
            />
          )}
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
