import axios from 'axios';
import { env } from '../config/env';

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word?: string;
  }>;
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramResponse {
  results?: {
    channels?: DeepgramChannel[];
  };
}

/**
 * Transcribes audio using Deepgram Nova-2 Speech-to-Text API.
 * Accepts an audio buffer with its mime type.
 * 
 * NOTE: The primary STT path uses the Web Speech API on the client side.
 * This server-side handler uses Deepgram Nova-2 as high-accuracy server-side STT,
 * for batch audio processing, fallback transcription, and audio answer submissions.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = 'audio/webm',
  language: string = 'en'
): Promise<string> {
  if (!env.DEEPGRAM_API_KEY) {
    throw new Error(
      'DEEPGRAM_API_KEY is not configured. Server-side STT is unavailable. ' +
      'Please configure DEEPGRAM_API_KEY in server/.env or use Web Speech API on the client.'
    );
  }

  // Deepgram Nova-2 listen endpoint parameters
  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: 'true',
    language,
  });

  const response = await axios.post<DeepgramResponse>(
    `https://api.deepgram.com/v1/listen?${params.toString()}`,
    audioBuffer,
    {
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
        'Content-Type': mimeType || 'audio/webm',
      },
      timeout: 30_000,
    }
  );

  const transcript =
    response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

  return transcript.trim();
}

/**
 * Cleans and normalises a raw STT transcript:
 * - Removes filler words (um, uh, like)
 * - Collapses repeated words
 * - Trims whitespace
 */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\b(um|uh|like|you know|basically|literally|honestly)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
