// Audio Manager — stereo channel separation for preview (LEFT) vs play (RIGHT)
//
// Use a stereo Y-splitter cable:
//   LEFT channel  → booth headphones / speaker (preview)
//   RIGHT channel → PA system input (play/broadcast)
//
// Uses Web Audio API StereoPannerNode to route audio to specific channels.

export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.currentSource = null;
    this.currentUrl = null;
    this.previewVolume = 0.5;
    this.playVolume = 1.0;
  }

  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  async playWithPan(audioBlob, pan, volume) {
    this.stop();

    const ctx = this.getContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    // Stereo panner: -1 = full left, 0 = center, 1 = full right
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    // Connect: source → gain → panner → output
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(ctx.destination);

    source.onended = () => {
      this.currentSource = null;
    };

    this.currentSource = source;
    source.start(0);
  }

  preview(audioBlob) {
    // LEFT channel (pan = -1) at preview volume
    this.playWithPan(audioBlob, -1, this.previewVolume);
  }

  play(audioBlob) {
    // RIGHT channel (pan = 1) at full volume
    this.playWithPan(audioBlob, 1, this.playVolume);
  }

  stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
  }

  setPreviewVolume(vol) {
    this.previewVolume = Math.max(0, Math.min(1, vol));
  }

  setPlayVolume(vol) {
    this.playVolume = Math.max(0, Math.min(1, vol));
  }
}
