import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { disconnectGoogle, loadGoogleCalendars, syncGoogleNow } from '@/lib/googleCalendar';
import { decorative, hitSlopFor, a11yState } from '@/lib/accessibility';

export default function GoogleCalendarScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { signInWithGoogle } = useAuthStore();

  const {
    googleCalendars,
    syncState,
    selectedCalendarIds,
    toggleCalendarSync,
    toggleBotsCanWrite,
    setSyncError,
  } = useSyncStore();

  const { events, batchUpsertEvents } = useCalendarStore();

  const isConnected = googleCalendars.length > 0;
  const { isSyncing, lastSyncAt, syncError } = syncState;

  // The server owns the calendar list; refresh it whenever this screen opens.
  useEffect(() => {
    loadGoogleCalendars().catch((e) => setSyncError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Announce async sync/connection results to VoiceOver (Android/web use the
  // live regions below). Only fires on transitions, not on first render.
  const prevA11yRef = useRef({ isSyncing, isConnected, syncError });
  useEffect(() => {
    const prev = prevA11yRef.current;
    prevA11yRef.current = { isSyncing, isConnected, syncError };
    if (Platform.OS !== 'ios') return;
    if (syncError && syncError !== prev.syncError) {
      AccessibilityInfo.announceForAccessibility(`Sync error: ${syncError}`);
    } else if (prev.isSyncing && !isSyncing && !syncError) {
      AccessibilityInfo.announceForAccessibility('Google Calendar sync complete');
    } else if (!prev.isConnected && isConnected) {
      AccessibilityInfo.announceForAccessibility('Google Calendar connected');
    }
  }, [isSyncing, isConnected, syncError]);

  const handleConnect = async () => {
    try {
      // On native this connects Google before returning; on web the page
      // redirects and the auth listener connects on return.
      await signInWithGoogle();
      await loadGoogleCalendars();
    } catch (e) {
      setSyncError(String(e));
    }
  };

  const handleSyncNow = async () => {
    if (!isConnected || isSyncing) return;
    await syncGoogleNow();
  };

  const handleDisconnect = () => {
    const doDisconnect = async () => {
      try {
        await disconnectGoogle();
        // The server removes them too; drop them here so the calendar updates at once.
        batchUpsertEvents([], events.filter((e) => e.source === 'google').map((e) => e.id));
      } catch (e) {
        setSyncError(String(e));
      }
    };

    if (Platform.OS === 'web') {
      // Alert.alert doesn't work on web — use window.confirm
      if (window.confirm('Disconnect Google Calendar?\n\nThis will remove all synced Google events from Meep. Your Google Calendar is not affected.')) {
        doDisconnect();
      }
    } else {
      Alert.alert(
        'Disconnect Google Calendar',
        'This will remove all synced Google events from Meep. Your Google Calendar is not affected.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: doDisconnect },
        ]
      );
    }
  };

  const lastSyncLabel = lastSyncAt
    ? `Last synced ${formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}`
    : 'Never synced';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Hide expo-router's auto-generated Stack header — we draw our own */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={hitSlopFor(32)}
        >
          <FontAwesome name="chevron-left" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>
          Google Calendar
        </Text>
      </View>

      {/* Connection status */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.borderRadius.md,
          },
        ]}
      >
        <View style={styles.cardRow}>
          <View
            {...decorative}
            style={[
              styles.googleDot,
              { backgroundColor: isConnected ? theme.colors.success : theme.colors.border },
            ]}
          />
          <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {isConnected ? 'Connected' : 'Not connected'}
            </Text>
            <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
              {isConnected ? lastSyncLabel : 'Connect to sync your Google calendars'}
            </Text>
          </View>

          {isConnected ? (
            <TouchableOpacity
              onPress={handleDisconnect}
              accessibilityRole="button"
              accessibilityLabel="Disconnect Google Calendar"
              hitSlop={hitSlopFor(31)}
              style={[
                styles.actionButton,
                { borderColor: theme.colors.error, borderRadius: theme.borderRadius.sm },
              ]}
            >
              <Text style={[styles.actionButtonText, { color: theme.colors.error }]}>
                Disconnect
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleConnect}
              accessibilityRole="button"
              accessibilityLabel="Connect Google Calendar"
              hitSlop={hitSlopFor(31)}
              style={[
                styles.actionButton,
                { borderColor: theme.colors.primary, borderRadius: theme.borderRadius.sm },
              ]}
            >
              <FontAwesome name="google" size={14} color={theme.colors.primary} />
              <Text style={[styles.actionButtonText, { color: theme.colors.primary, marginLeft: 6 }]}>
                Connect
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sync error */}
        {syncError ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[styles.errorText, { color: theme.colors.error }]}
          >
            {syncError}
          </Text>
        ) : null}
      </View>

      {/* Sync Now button */}
      {isConnected && (
        <TouchableOpacity
          onPress={handleSyncNow}
          disabled={isSyncing}
          accessibilityRole="button"
          accessibilityLabel={isSyncing ? 'Syncing' : 'Sync now'}
          {...a11yState({ disabled: isSyncing, busy: isSyncing })}
          style={[
            styles.syncButton,
            {
              backgroundColor: isSyncing ? theme.colors.surface : theme.colors.primary,
              borderRadius: theme.borderRadius.md,
              opacity: isSyncing ? 0.7 : 1,
            },
          ]}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <FontAwesome name="refresh" size={14} color={theme.colors.onPrimary} />
          )}
          <Text
            style={[
              styles.syncButtonText,
              { color: isSyncing ? theme.colors.textSecondary : theme.colors.onPrimary, marginLeft: 8 },
            ]}
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Calendar list */}
      {isConnected && googleCalendars.length > 0 && (
        <>
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            Calendars to Sync
          </Text>

          {googleCalendars.map((cal) => (
            <View
              key={cal.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                },
              ]}
            >
              <View style={styles.cardRow}>
                {/* Calendar colour swatch */}
                <View
                  {...decorative}
                  style={[
                    styles.calendarSwatch,
                    { backgroundColor: cal.backgroundColor, borderRadius: theme.borderRadius.sm },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                    {cal.summary}
                    {cal.primary ? (
                      <Text style={{ color: theme.colors.textSecondary }}> (primary)</Text>
                    ) : null}
                  </Text>
                  <Text style={[styles.calendarId, { color: theme.colors.textTertiary }]}>
                    {cal.id}
                  </Text>
                </View>
                <Switch
                  value={selectedCalendarIds.includes(cal.id)}
                  onValueChange={() => toggleCalendarSync(cal.id)}
                  accessibilityLabel={`Sync ${cal.summary}`}
                  trackColor={{ true: theme.colors.primary }}
                  // The "on" track is the near-white primary; keep the thumb visible on it.
                  thumbColor={selectedCalendarIds.includes(cal.id) ? theme.colors.onPrimary : undefined}
                />
              </View>
              {selectedCalendarIds.includes(cal.id) && (
                <View style={[styles.cardRow, styles.botsRow, { borderTopColor: theme.colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.botsTitle, { color: theme.colors.text }]}>Bots can edit</Text>
                    <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                      Let your bots add and move blocks here
                    </Text>
                  </View>
                  <Switch
                    value={cal.botsCanWrite}
                    onValueChange={() => toggleBotsCanWrite(cal.id)}
                    accessibilityLabel={`Let bots edit ${cal.summary}`}
                    trackColor={{ true: theme.colors.primary }}
                    thumbColor={cal.botsCanWrite ? theme.colors.onPrimary : undefined}
                  />
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* Info note at the bottom */}
      <View style={styles.infoBox}>
        <FontAwesome name="info-circle" size={13} color={theme.colors.textTertiary} {...decorative} />
        <Text style={[styles.infoText, { color: theme.colors.textTertiary }]}>
          Changes you make to Google events in Meep are saved to Google. Bots only touch calendars you let them edit.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },
  card: {
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 13,
    marginTop: 2,
  },
  calendarId: {
    fontSize: 11,
    marginTop: 2,
  },
  botsRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  botsTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarSwatch: {
    width: 32,
    height: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    marginTop: 4,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
