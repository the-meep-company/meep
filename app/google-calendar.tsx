import {
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
import { Stack, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { fetchGoogleCalendars, performSync } from '@/lib/googleCalendar';

export default function GoogleCalendarScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { session, signInWithGoogle } = useAuthStore();
  const accessToken = session?.provider_token ?? null;

  const {
    googleCalendars,
    syncState,
    selectedCalendarIds,
    toggleCalendarSync,
    setSyncing,
    setSyncError,
    setLastSync,
    clearSync,
  } = useSyncStore();

  const { events, batchUpsertEvents } = useCalendarStore();

  const isConnected = googleCalendars.length > 0;
  const { isSyncing, lastSyncAt, syncError } = syncState;

  // Persist sync tokens across syncs (stored in memory for now; move to
  // syncStore persistence if you want them to survive app restarts)
  const syncTokensRef = { current: {} as Record<string, string> };

  const handleConnect = async () => {
    try {
      await signInWithGoogle();
      if (session?.provider_token) {
        const calendars = await fetchGoogleCalendars(session.provider_token);
        useSyncStore.getState().setGoogleCalendars(calendars);
      }
    } catch (e) {
      setSyncError(String(e));
    }
  };

  const handleSyncNow = async () => {
    if (!isConnected || isSyncing) return;
    await performSync({
      accessToken: accessToken ?? '',
      googleCalendars,
      selectedCalendarIds,
      syncTokens: syncTokensRef.current,
      existingEvents: events,
      onSyncStart: () => setSyncing(true),
      onSyncSuccess: (nextTokens) => {
        syncTokensRef.current = { ...syncTokensRef.current, ...nextTokens };
        setSyncing(false);
        setLastSync(new Date());
      },
      onSyncError: (err) => {
        setSyncing(false);
        setSyncError(err);
      },
      batchUpsertEvents,
      setLastSync,
    });
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Google Calendar',
      'This will remove all synced Google events from Meep. Your Google Calendar is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            // Remove Google-sourced events from calendarStore
            const remaining = events.filter((e) => e.source !== 'google');
            batchUpsertEvents(remaining, []);
            clearSync();
          },
        },
      ]
    );
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
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
            style={[
              styles.googleDot,
              { backgroundColor: isConnected ? theme.colors.success : theme.colors.border },
            ]}
          />
          <View style={{ flex: 1 }}>
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
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {syncError}
          </Text>
        ) : null}
      </View>

      {/* Sync Now button */}
      {isConnected && (
        <TouchableOpacity
          onPress={handleSyncNow}
          disabled={isSyncing}
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
            <FontAwesome name="refresh" size={14} color="#fff" />
          )}
          <Text
            style={[
              styles.syncButtonText,
              { color: isSyncing ? theme.colors.textSecondary : '#fff', marginLeft: 8 },
            ]}
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Calendar list */}
      {isConnected && googleCalendars.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
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
                  trackColor={{ true: theme.colors.primary }}
                />
              </View>
            </View>
          ))}
        </>
      )}

      {/* Info note at the bottom */}
      <View style={styles.infoBox}>
        <FontAwesome name="info-circle" size={13} color={theme.colors.textTertiary} />
        <Text style={[styles.infoText, { color: theme.colors.textTertiary }]}>
          Google Calendar events are read-only in Meep v1. To edit them, open Google Calendar directly.
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
