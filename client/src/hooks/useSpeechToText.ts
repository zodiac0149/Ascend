import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechToTextOptions {
  language?: string;
  continuous?: boolean;
  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
}

interface UseSpeechToTextReturn {
  isListening: boolean;
  transcript: string;           // live interim transcript
  finalTranscript: string;      // committed final text
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => Promise<string>;
  resetTranscript: () => void;
  error: string | null;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string; confidence: number };
    };
  };
}

interface ISpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

// Extend Window to include SpeechRecognition vendors
declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

export function useSpeechToText({
  language = 'en-US',
  continuous = true,
  onFinalTranscript,
  onInterimTranscript,
}: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalBufferRef = useRef<string>('');
  const stopResolveRef = useRef<((text: string) => void) | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const initRecognition = useCallback((): ISpeechRecognition | null => {
    if (!isSupported) return null;

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      let final = finalBufferRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';

        if (result.isFinal) {
          final += (final ? ' ' : '') + text.trim();
          finalBufferRef.current = final;
          onFinalTranscript?.(text.trim());
        } else {
          interim += text;
        }
      }

      setFinalTranscript(final);
      setTranscript(final + (interim ? ' ' + interim : ''));
      onInterimTranscript?.(interim);
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setError(`STT Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Resolve the stopListening promise with accumulated final text
      if (stopResolveRef.current) {
        stopResolveRef.current(finalBufferRef.current);
        stopResolveRef.current = null;
      }
    };

    return recognition;
  }, [isSupported, language, continuous, onFinalTranscript, onInterimTranscript]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    // Stop any existing session
    recognitionRef.current?.abort();

    finalBufferRef.current = '';
    setTranscript('');
    setFinalTranscript('');
    setError(null);

    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('[STT] Failed to start recognition:', err);
      setError('Failed to start speech recognition.');
    }
  }, [isSupported, initRecognition]);

  const stopListening = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current || !isListening) {
        resolve(finalBufferRef.current);
        return;
      }
      stopResolveRef.current = resolve;
      recognitionRef.current.stop();
    });
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    finalBufferRef.current = '';
    setTranscript('');
    setFinalTranscript('');
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isListening,
    transcript,
    finalTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  };
}
