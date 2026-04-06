// ElevenLabs TTS implementation

import { TTSProvider } from './tts-provider.js';

const API_BASE = 'https://api.elevenlabs.io/v1';

// Voice settings tuned per energy level
// stability: lower = more expressive/varied, higher = more monotone/consistent
// style: higher = more dramatic delivery
const ENERGY_SETTINGS = {
  high: {
    stability: 0.35,
    similarity_boost: 0.75,
    style: 0.65,
    use_speaker_boost: true,
  },
  neutral: {
    stability: 0.7,
    similarity_boost: 0.8,
    style: 0.15,
    use_speaker_boost: true,
  },
};

export class ElevenLabsTTS extends TTSProvider {
  constructor(storage) {
    super('ElevenLabs');
    this.storage = storage;
    this.apiKey = storage.getApiKey();
    this.voiceId = storage.getVoiceId() || '';
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  setVoice(voiceId) {
    this.voiceId = voiceId;
  }

  async generateAudio(text, energy) {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not set. Go to Settings.');
    }
    if (!this.voiceId) {
      throw new Error('No voice selected. Go to Settings.');
    }

    const voiceSettings = ENERGY_SETTINGS[energy] || ENERGY_SETTINGS.neutral;

    const response = await fetch(`${API_BASE}/text-to-speech/${this.voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid API key. Check Settings.');
      }
      throw new Error(`TTS failed (${response.status}): ${err}`);
    }

    const blob = await response.blob();
    return blob;
  }

  async listVoices() {
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${API_BASE}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return (data.voices || []).map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
      }));
    } catch {
      return [];
    }
  }
}
