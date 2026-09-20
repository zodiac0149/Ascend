import axios from 'axios';
import { env } from '../config/env';

const MURF_API_BASE = 'https://api.murf.ai/v1';

interface MurfSpeechRequest {
  voice_id: string;
  style: string;
  text: string;
  rate: number;
  pitch: number;
  sample_rate: number;
  format: 'MP3' | 'WAV' | 'FLAC' | 'ALAW' | 'ULAW';
  channel_type: 'STEREO' | 'MONO';
  model_version: 'GEN2' | 'GEN1';
}

interface MurfSpeechResponse {
  audio_file: string;      // URL to the generated audio
  audio_length_seconds: number;
  consumed_character_count: number;
  warning_code?: string;
  warning_message?: string;
}

/**
 * Synthesises speech via Murf AI, then downloads the audio and converts
 * it to a base64 data URI so the client can play it directly.
 *
 * @param text       The text to speak (AI question / acknowledgement)
 * @returns          base64 MP3 data URI — "data:audio/mpeg;base64,..."
 */
export async function synthesiseSpeech(text: string): Promise<string> {
  // ── 1. Request Murf to generate audio ───────────────────────────────────────
  const requestBody: MurfSpeechRequest = {
    voice_id: env.MURF_VOICE_ID,         // e.g. "en-US-iris"
    style: 'Conversational',             // best style for interview context
    text: text.slice(0, 3000),           // Murf max per request
    rate: 0,                             // 0 = normal speed (range: -50 to 50)
    pitch: 0,                            // 0 = natural pitch
    sample_rate: 24000,                  // 24kHz — good quality, reasonable size
    format: 'MP3',
    channel_type: 'STEREO',
    model_version: 'GEN2',              // latest Murf model
  };

  const generateResponse = await axios.post<MurfSpeechResponse>(
    `${MURF_API_BASE}/speech/generate`,
    requestBody,
    {
      headers: {
        'api-key': env.MURF_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );

  const { audio_file } = generateResponse.data;

  if (!audio_file) {
    throw new Error('[TTS] Murf AI did not return an audio_file URL.');
  }

  // ── 2. Download the audio file ──────────────────────────────────────────────
  const audioResponse = await axios.get<ArrayBuffer>(audio_file, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });

  // ── 3. Convert to base64 data URI ───────────────────────────────────────────
  const base64 = Buffer.from(audioResponse.data).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

/**
 * Returns a list of available Murf AI voices for the given locale.
 * Useful for debugging or presenting voice selection options.
 */
export async function listVoices(locale = 'en-US'): Promise<unknown> {
  const response = await axios.get(`${MURF_API_BASE}/speech/voices`, {
    headers: { 'api-key': env.MURF_API_KEY },
    params: { locale },
    timeout: 10_000,
  });
  return response.data;
}
