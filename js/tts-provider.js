// TTS Provider interface — pluggable design for swapping providers

export class TTSProvider {
  constructor(name) {
    this.name = name;
  }

  async generateAudio(text, voiceConfig) {
    throw new Error('generateAudio() must be implemented by subclass');
  }

  async listVoices() {
    throw new Error('listVoices() must be implemented by subclass');
  }
}
