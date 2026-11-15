// Time zone helpers for Settings → Time zone.

const FALLBACK_ZONE = 'Europe/London';

/** The device's current IANA zone. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_ZONE;
  } catch {
    return FALLBACK_ZONE;
  }
}

// Used when the JS engine can't list zones itself (older Hermes).
const COMMON_ZONES = [
  'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Vancouver',
  'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/Mexico_City',
  'America/New_York', 'America/Toronto', 'America/Bogota', 'America/Lima',
  'America/Halifax', 'America/Santiago', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'Atlantic/Reykjavik', 'Europe/London', 'Europe/Dublin', 'Europe/Lisbon',
  'Europe/Paris', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Brussels',
  'Europe/Rome', 'Europe/Zurich', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen',
  'Europe/Warsaw', 'Europe/Vienna', 'Europe/Prague', 'Europe/Athens', 'Europe/Helsinki',
  'Europe/Kyiv', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Lagos', 'Africa/Cairo',
  'Africa/Johannesburg', 'Africa/Nairobi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Tehran',
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Manila', 'Asia/Seoul',
  'Asia/Tokyo', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Brisbane',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
];

let zones: string[] | undefined;

/** Every zone the picker offers, always including the device's own. */
export function listTimeZones(): string[] {
  if (!zones) {
    let all: string[] = [];
    try {
      const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
      if (supported) all = supported('timeZone');
    } catch {
      // fall through to the built-in list
    }
    if (all.length === 0) all = COMMON_ZONES;
    zones = Array.from(new Set([...all, deviceTimeZone()])).sort();
  }
  return zones;
}

/** "Europe/London" → "London"; "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function timeZoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

/** "Europe/London" → "Europe"; "" for zones without a region (e.g. "UTC"). */
export function timeZoneRegion(zone: string): string {
  const parts = zone.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join(' / ').replace(/_/g, ' ') : '';
}

/** Current UTC offset such as "GMT+1", or "" if the engine can't format it. */
export function timeZoneOffset(zone: string): string {
  for (const timeZoneName of ['shortOffset', 'short'] as const) {
    try {
      const part = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName');
      if (part?.value) return part.value;
    } catch {
      // try the next format
    }
  }
  return '';
}
