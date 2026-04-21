// Web Speech API wrapper for voice recognition on web (browser only).
// Expo's bundler automatically uses this file on web, and voice.ts on native.

type ResultCallback = (text: string) => void;
type ErrorCallback = (error: string) => void;

// The Web Speech API is not in TypeScript's default lib, so we type it minimally.
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

let recognition: SpeechRecognitionInstance | null = null;
let resultCb: ResultCallback | null = null;
let errorCb: ErrorCallback | null = null;
let interimCb: ResultCallback | null = null;

// Accumulates finalized transcript segments during continuous recording
let finalTranscript = '';

export function onResult(callback: ResultCallback) {
  resultCb = callback;
}

export function onError(callback: ErrorCallback) {
  errorCb = callback;
}

// Called with live interim text as the user speaks — useful for real-time display
export function onInterim(callback: ResultCallback) {
  interimCb = callback;
}

export function startListening(locale: string) {
  const SpeechRecognition =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    errorCb?.('Speech recognition is not supported in this browser.');
    return;
  }

  finalTranscript = '';

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true; // enables real-time preview
  recognition.lang = locale;

  recognition.onresult = (e: SpeechRecognitionEvent) => {
    // e.results is cumulative — rebuild from scratch each time
    let finals = '';
    let interim = '';

    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        finals += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }

    finalTranscript = finals.trim();
    const preview = (finalTranscript + (interim ? ' ' + interim : '')).trim();
    if (preview) interimCb?.(preview);
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') {
      // Non-fatal in continuous mode — just keep listening
      return;
    } else if (e.error === 'not-allowed') {
      errorCb?.('Microphone access was denied. Please allow it in your browser settings.');
    } else {
      errorCb?.(`Speech recognition error: ${e.error}`);
    }
  };

  recognition.onend = () => {
    // Deliver final accumulated transcript when user manually stops
    const final = finalTranscript.trim();
    if (final) resultCb?.(final);
    finalTranscript = '';
    recognition = null;
  };

  recognition.start();
}

export function stopListening() {
  // stop() lets the engine finish its current utterance then fires onend
  recognition?.stop();
}

export function isSupported(): boolean {
  return !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}
