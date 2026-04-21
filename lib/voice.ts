// Native voice recognition stub.
// Web uses voice.web.ts automatically via Expo's platform-specific file resolution.
// Native (iOS/Android) support will be added in a future phase using expo-speech or Whisper API.

type ResultCallback = (text: string) => void;
type ErrorCallback = (error: string) => void;

let errorCb: ErrorCallback | null = null;

export function onResult(_callback: ResultCallback) {
  // No-op on native until implemented
}

export function onError(callback: ErrorCallback) {
  errorCb = callback;
}

export function onInterim(_callback: ResultCallback) {
  // No-op on native until implemented
}

export function startListening(_locale: string) {
  errorCb?.('Voice input is not yet available on native. Use the text input instead.');
}

export function stopListening() {
  // No-op
}

export function isSupported(): boolean {
  return false;
}
