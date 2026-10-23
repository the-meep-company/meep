import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView, Linking,
  KeyboardAvoidingView, Platform, ActivityIndicator, AccessibilityInfo, type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { hitSlopFor, a11yState, decorative } from '@/lib/accessibility';
import { MeshBackground, GrainOverlay } from '@/components/common/GlassBackground';
import { getBackgroundPreset } from '@/lib/backgrounds';

const ENABLE_APPLE_SIGN_IN = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN === 'true';

// The reference's warm-to-teal gradient, shared with the Ember wallpaper.
const EMBER = getBackgroundPreset('ember');

// The sheet is always dark (it sits on the fixed Ember gradient), so its text
// colors are fixed rather than theme tokens. All pass AA on SHEET.
const SHEET = '#131313';
const TEXT = '#F5F5F5';
const MUTED = 'rgba(245,245,245,0.66)';
const LINE = 'rgba(255,255,255,0.40)'; // 3:1+ field boundary (WCAG 1.4.11)
const HIGHLIGHT = '#FFB38A';
const ERROR = '#FF9C8A';

type Mode = 'signin' | 'signup';
type Sent = { kind: 'signup' | 'reset'; email: string };

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const {
    signInWithGoogle, signInWithApple, signInWithEmail, signUp, continueAsGuest,
    resendSignUpEmail, resetPassword,
  } = useAuthStore();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const isSignUp = mode === 'signup';

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.title = sent ? 'Check your email – Meep' : isSignUp ? 'Create account – Meep' : 'Sign in – Meep';
  }, [isSignUp, sent]);

  const showSent = (next: Sent) => {
    setSent(next);
    setResendStatus(null);
    AccessibilityInfo.announceForAccessibility(`Check your email. We've sent a link to ${next.email}`);
  };

  const handleEmailAuth = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (isSignUp) showSent({ kind: 'signup', email: email.trim() });
  };

  const handleForgot = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot.');
      return;
    }
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);
    if (result.error) setError(result.error);
    else showSent({ kind: 'reset', email: email.trim() });
  };

  const handleResend = async () => {
    if (!sent) return;
    setLoading(true);
    const result = sent.kind === 'signup'
      ? await resendSignUpEmail(sent.email)
      : await resetPassword(sent.email);
    setLoading(false);
    setResendStatus(result.error ?? 'Sent again. It can take a minute to arrive.');
  };

  const handleProvider = async (signIn: () => Promise<void>, name: string) => {
    setError(null);
    setLoading(true);
    try {
      await signIn();
    } catch (err: any) {
      setError(err?.message || `${name} sign-in failed`);
    }
    setLoading(false);
  };

  return (
    <View style={styles.root}>
      <MeshBackground preset={EMBER} />
      <GrainOverlay level="subtle" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          role="main"
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: the gradient, the wordmark, one big line */}
          <View style={[styles.hero, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
            <Text style={styles.brand}>meep</Text>
            <View style={styles.flex} />
            <Text style={styles.headline} maxFontSizeMultiplier={1.3}>
              Clear your head.{'\n'}
              <Text style={styles.headlineMuted}>Meep plans the rest.</Text>
            </Text>
          </View>

          {/* Bottom sheet */}
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.grabber} {...decorative} />

            {sent ? (
              <View style={styles.sentBody}>
                <View style={styles.iconTile} {...decorative}>
                  <FontAwesome name="envelope-open" size={18} color={TEXT} />
                </View>
                <Text accessibilityRole="header" style={[styles.title, styles.center]}>
                  Check your <Text style={{ color: HIGHLIGHT }}>email</Text>
                </Text>
                <Text style={[styles.subtitle, styles.center]}>
                  {sent.kind === 'signup'
                    ? "We've sent a confirmation link to:"
                    : "We've sent a password reset link to:"}
                  {'\n'}
                  <Text style={{ color: TEXT }}>{sent.email}</Text>
                </Text>

                <View style={styles.sentActions}>
                  {Platform.OS === 'ios' ? (
                    <PrimaryButton label="Open email app" onPress={() => Linking.openURL('message://')} />
                  ) : (
                    <PrimaryButton label="Back to sign in" onPress={() => { setSent(null); setMode('signin'); }} />
                  )}
                  <TextLink
                    label="Resend email"
                    onPress={handleResend}
                    disabled={loading}
                  />
                  {Platform.OS === 'ios' && (
                    <TextLink label="Back to sign in" onPress={() => { setSent(null); setMode('signin'); }} />
                  )}
                  {resendStatus ? (
                    <Text
                      style={[styles.status, styles.center]}
                      accessibilityLiveRegion="polite"
                      role="status"
                    >
                      {resendStatus}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {isSignUp ? (
                    <>Create your <Text style={{ color: HIGHLIGHT }}>account</Text></>
                  ) : (
                    <>Welcome <Text style={{ color: HIGHLIGHT }}>back</Text></>
                  )}
                </Text>
                <Text style={styles.subtitle}>
                  {isSignUp
                    ? 'Save your plans and sync them across devices.'
                    : 'Sign in to sync your calendar across devices.'}
                </Text>

                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <Field
                  ref={passwordRef}
                  label="Password"
                  right={
                    !isSignUp ? (
                      <Pressable
                        onPress={handleForgot}
                        disabled={loading}
                        accessibilityRole="button"
                        accessibilityLabel="Forgot password"
                        hitSlop={hitSlopFor(20)}
                      >
                        <Text style={styles.forgot}>Forgot?</Text>
                      </Pressable>
                    ) : null
                  }
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  returnKeyType="go"
                  onSubmitEditing={handleEmailAuth}
                />

                {error ? (
                  <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                    {error}
                  </Text>
                ) : null}

                <PrimaryButton
                  label={isSignUp ? 'Create account' : 'Sign in'}
                  onPress={handleEmailAuth}
                  loading={loading}
                />

                <View style={styles.divider} {...decorative}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {Platform.OS === 'ios' && ENABLE_APPLE_SIGN_IN ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                    cornerRadius={BUTTON / 2}
                    style={styles.appleButton}
                    onPress={() => handleProvider(signInWithApple, 'Apple')}
                  />
                ) : null}

                <View style={styles.row}>
                  <Pressable
                    onPress={() => handleProvider(signInWithGoogle, 'Google')}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Google"
                    {...a11yState({ disabled: loading })}
                    style={({ pressed }) => [styles.outline, styles.grow, pressed && styles.pressed]}
                  >
                    <FontAwesome name="google" size={16} color={TEXT} {...decorative} />
                    <Text style={styles.outlineText}>Google</Text>
                  </Pressable>
                  <Pressable
                    onPress={continueAsGuest}
                    accessibilityRole="button"
                    accessibilityLabel="Continue without an account"
                    style={({ pressed }) => [styles.outline, styles.grow, pressed && styles.pressed]}
                  >
                    <FontAwesome name="user-o" size={15} color={TEXT} {...decorative} />
                    <Text style={styles.outlineText}>Guest</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); }}
                  accessibilityRole="button"
                  accessibilityLabel={isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  style={styles.switchRow}
                >
                  <Text style={styles.switchText}>
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                    <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PrimaryButton({ label, onPress, loading = false }: { label: string; onPress: () => void; loading?: boolean }) {
  const { theme } = useThemeStore();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...a11yState({ disabled: loading, busy: loading })}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: theme.colors.primary },
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onPrimary} />
      ) : (
        <Text style={[styles.primaryText, { color: theme.colors.onPrimary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...a11yState({ disabled })}
      style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
    >
      <Text style={styles.textLinkText}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string; right?: React.ReactNode; ref?: React.Ref<TextInput> };

/** Underlined field with a visible label (placeholders alone vanish once you type). */
function Field({ label, right, ref, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, { borderBottomColor: focused ? TEXT : LINE }]}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {right}
      </View>
      <TextInput
        ref={ref}
        {...input}
        accessibilityLabel={label}
        placeholderTextColor="rgba(245,245,245,0.42)"
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        style={styles.input}
      />
    </View>
  );
}

const BUTTON = 54;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0F12',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    flex: 1,
    minHeight: 220,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  brand: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -1.2,
    lineHeight: 44,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 12,
  },
  headlineMuted: {
    color: 'rgba(255,255,255,0.78)',
  },
  sheet: {
    backgroundColor: SHEET,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 22,
  },
  title: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  center: {
    textAlign: 'center',
  },
  field: {
    borderBottomWidth: 1,
    marginTop: 20,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: MUTED,
    fontSize: 13,
  },
  forgot: {
    color: TEXT,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  input: {
    color: TEXT,
    fontSize: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  error: {
    color: ERROR,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  primary: {
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dividerText: {
    color: MUTED,
    fontSize: 13,
  },
  appleButton: {
    width: '100%',
    height: BUTTON,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  grow: {
    flex: 1,
  },
  outline: {
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  outlineText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '500',
  },
  switchRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  switchText: {
    color: MUTED,
    fontSize: 14,
  },
  switchLink: {
    color: TEXT,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  sentBody: {
    alignItems: 'stretch',
    paddingTop: 8,
  },
  iconTile: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sentActions: {
    marginTop: 8,
    marginBottom: 8,
  },
  textLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  textLinkText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '500',
  },
  status: {
    color: MUTED,
    fontSize: 13,
    marginTop: 4,
  },
});
