import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

const ENABLE_APPLE_SIGN_IN = process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN === 'true';

export default function LoginScreen() {
  const { theme } = useThemeStore();
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUp, continueAsGuest } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (isSignUp) {
      Alert.alert('Check your email', 'We sent you a confirmation link. Please verify your email to sign in.');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Google sign-in failed');
    }
    setLoading(false);
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Apple sign-in failed');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo / Title */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: theme.colors.primary }]}>Meep</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Your AI calendar companion
          </Text>
        </View>

        {/* Google Sign-In */}
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Text style={[styles.googleButtonText, { color: theme.colors.text }]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && ENABLE_APPLE_SIGN_IN ? (
          <View style={styles.appleButtonWrap}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        </View>

        {/* Email/Password Form */}
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            borderRadius: theme.borderRadius.md,
          }]}
          placeholder="Email"
          placeholderTextColor={theme.colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            borderRadius: theme.borderRadius.md,
          }]}
          placeholder="Password"
          placeholderTextColor={theme.colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md }]}
          onPress={handleEmailAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle sign in / sign up */}
        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: theme.colors.textSecondary }]}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <Text style={[styles.toggleLink, { color: theme.colors.primary }]}>
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        {/* Guest mode */}
        <TouchableOpacity onPress={continueAsGuest} style={styles.guestButton}>
          <Text style={[styles.guestText, { color: theme.colors.textSecondary }]}>
            Continue without an account
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  appleButtonWrap: {
    marginBottom: 20,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
  },
  input: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 12,
    fontSize: 16,
  },
  primaryButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  toggleText: {
    fontSize: 14,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  guestButton: {
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 12,
  },
  guestText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
