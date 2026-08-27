'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { m } from 'motion/react';
import { useUser } from '@/stores/user';
import { Icon } from '@/components/ui/Icon';

/**
 * Voice search, using the Web Speech API.
 *
 * The API is not standard across browsers: it is `webkitSpeechRecognition` in Chrome and
 * Safari and absent entirely in Firefox. So this **renders nothing at all** where it is
 * unsupported, rather than showing a microphone that does nothing when tapped. A dead
 * control is worse than a missing one, because the listener cannot tell whether it failed or
 * they used it wrong.
 *
 * Support is read through `useSyncExternalStore` with a `false` server snapshot. The check
 * can only run in the browser, and this is the primitive designed for a value that
 * legitimately differs between server and client: React expects the difference instead of
 * treating it as a hydration error.
 */

/** Minimal shape of the parts used here. The DOM lib's own typings for this are
 *  inconsistent across TypeScript versions and the vendor-prefixed constructor is untyped. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};
const clientSupported = () => getConstructor() !== null;
const serverSupported = () => false;

/**
 * The listener's own languages, mapped to speech tags.
 *
 * Recognition accuracy depends heavily on the language hint, and this catalogue is
 * Indian-market: someone whose library is Punjabi is likely to say a Punjabi title, and
 * asking the recogniser for US English would mangle it. The language they already chose in
 * settings is the best available guess, and `en-IN` is the fallback because Indian English is
 * how most listeners here would pronounce a Latin-script title.
 */
const SPEECH_TAGS: Record<string, string> = {
  hindi: 'hi-IN',
  english: 'en-IN',
  punjabi: 'pa-IN',
  tamil: 'ta-IN',
  telugu: 'te-IN',
  marathi: 'mr-IN',
  bengali: 'bn-IN',
  kannada: 'kn-IN',
  malayalam: 'ml-IN',
  gujarati: 'gu-IN',
  urdu: 'ur-IN',
};

export function VoiceSearchButton({
  onTranscript,
  onSubmit,
}: {
  /** Called with interim and final text, so the field fills in as the listener speaks. */
  onTranscript: (text: string) => void;
  /** Called once with the final transcript, to run the search. */
  onSubmit: (text: string) => void;
}) {
  const supported = useSyncExternalStore(noSubscribe, clientSupported, serverSupported);
  const languages = useUser((state) => state.languages);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  if (!supported) return null;

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function start() {
    const Constructor = getConstructor();
    if (!Constructor) return;
    if (listening) {
      stop();
      return;
    }

    setError(false);
    const recognition = new Constructor();
    recognitionRef.current = recognition;
    recognition.lang = SPEECH_TAGS[languages[0] ?? ''] ?? 'en-IN';
    // One utterance, not a continuous dictation. This is a search box: the listener says a
    // title and expects it to run, not to keep an open microphone.
    recognition.continuous = false;
    // Interim results fill the field as they speak, which is the feedback that tells them the
    // microphone is actually hearing something.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = '';
      let final = false;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        text += result[0]?.transcript ?? '';
        if (result.isFinal) final = true;
      }
      const trimmed = text.trim();
      if (!trimmed) return;
      onTranscript(trimmed);
      if (final) {
        setListening(false);
        onSubmit(trimmed);
      }
    };

    // Covers a denied microphone permission, no speech detected, and network failures in the
    // recogniser. None of them are distinguishable usefully, and all mean the same thing here.
    recognition.onerror = () => {
      setError(true);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch {
      // `start()` throws if called while already running, which can happen if a previous
      // session has not finished tearing down.
      setError(true);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={listening ? 'Stop listening' : 'Search by voice'}
      aria-pressed={listening}
      title={error ? 'Voice search could not start' : 'Search by voice'}
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
        listening
          ? 'bg-accent text-on-accent'
          : error
            ? 'text-amber-300 hover:bg-white/10'
            : 'text-text-secondary hover:bg-white/10 hover:text-white'
      }`}
    >
      {/* An expanding ring while listening. This is the only feedback that the microphone is
          live, and it has to be visible without reading anything. */}
      {listening && (
        <m.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-accent"
          animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <Icon name="mic" size={17} className="relative" />
    </button>
  );
}
