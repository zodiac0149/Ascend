import { useCallback, useRef, useState } from 'react';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  play: (src: string) => Promise<void>;
  speakText: (text: string) => Promise<void>;
  stop: () => void;
  error: string | null;
}

/**
 * Manages TTS audio playback.
 * Accepts a base64 data URI (from Murf AI) or a regular URL.
 * Also provides a speakText() fallback using browser SpeechSynthesis API.
 * Returns a promise that resolves when the audio finishes playing.
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    // Stop HTML audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop browser speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Stop any currently playing audio
        stop();
        setError(null);

        const audio = new Audio(src);
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);

        audio.onended = () => {
          setIsPlaying(false);
          audioRef.current = null;
          resolve();
        };

        audio.onerror = (e) => {
          setIsPlaying(false);
          audioRef.current = null;
          const message = 'Failed to play audio.';
          setError(message);
          console.error('[useAudioPlayer] Audio error:', e);
          reject(new Error(message));
        };

        audio.play().catch((err: Error) => {
          setIsPlaying(false);
          audioRef.current = null;
          // Autoplay blocked by browser policy — resolve gracefully
          if (err.name === 'NotAllowedError') {
            console.warn('[useAudioPlayer] Autoplay blocked — user interaction required first.');
            resolve();
          } else {
            setError(err.message);
            reject(err);
          }
        });
      });
    },
    [stop]
  );

  /**
   * Browser-native TTS fallback using the Web Speech API.
   * Used when Murf AI TTS is unavailable or fails.
   */
  const speakText = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          console.warn('[useAudioPlayer] SpeechSynthesis API not available in this browser.');
          resolve();
          return;
        }

        stop();
        setError(null);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        // Try to select a natural-sounding voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.toLowerCase().includes('natural') ||
             v.name.toLowerCase().includes('google') ||
             v.name.toLowerCase().includes('microsoft'))
        );
        if (preferred) utterance.voice = preferred;

        utterance.onstart = () => setIsPlaying(true);

        utterance.onend = () => {
          setIsPlaying(false);
          resolve();
        };

        utterance.onerror = (e) => {
          setIsPlaying(false);
          console.warn('[useAudioPlayer] SpeechSynthesis error:', e.error);
          resolve(); // resolve gracefully — don't block the flow
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [stop]
  );

  return { isPlaying, play, speakText, stop, error };
}

