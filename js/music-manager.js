// Music Manager — cue file upload, storage, and playback
// Handles: goal horn, timeout music, atmosphere loop, per-player walkup songs
//
// Audio routing: all music cues play on the RIGHT channel (PA/broadcast)
// via the shared Web Audio context + StereoPannerNode. Consistent with
// how AudioManager routes TTS announcements.
//
// Storage: blobs live in IndexedDB (AudioStorage). The HTML Audio element
// is routed through AudioContext for stereo panning.

import { AudioStorage, CUE_KEYS } from './audio-storage.js';

export class MusicManager {
  constructor(audioManager, gameState) {
    this.audioStorage = new AudioStorage();
    this.audioManager = audioManager;  // shared AudioManager for Web Audio context
    this.gameState = gameState;

    // Track which cues have stored blobs (populated async at init)
    this.cueStatus = {}; // key → boolean

    // Active music playback (cue track — goal horn, timeout, walkup)
    this._activeAudio = null;
    this._activeUrl = null;
    this._activeSource = null;

    // Atmosphere track — separate from cue track, runs independently
    this._atmosphereAudio = null;
    this._atmosphereUrl = null;
    this._atmosphereSource = null;
    this._atmosphereGain = null;
    this._atmosphereVolume = 0.35; // default 35% — ambient under announcements
  }

  setGameState(gs) {
    this.gameState = gs;
    this.render();
  }

  // ─── Playback ────────────────────────────────────────────────────────────

  async playGoalHorn() {
    const blob = await this.audioStorage.load(CUE_KEYS.goalHorn());
    if (!blob) return;
    await this._playBlob(blob, false);
  }

  async playTimeout() {
    const blob = await this.audioStorage.load(CUE_KEYS.timeout());
    if (!blob) return;
    await this._playBlob(blob, true); // loop until stopped
  }

  async playWalkup(team, number) {
    const blob = await this.audioStorage.load(CUE_KEYS.walkup(team, number));
    if (!blob) return;
    await this._playBlob(blob, true); // loop until play/clear
  }

  // Stop the active cue track (walkup, goal horn, timeout). Does NOT affect atmosphere.
  stopMusic() {
    if (this._activeAudio) {
      this._activeAudio.pause();
      this._activeAudio = null;
    }
    if (this._activeUrl) {
      URL.revokeObjectURL(this._activeUrl);
      this._activeUrl = null;
    }
    if (this._activeSource) {
      try { this._activeSource.disconnect(); } catch { /* already gone */ }
      this._activeSource = null;
    }
    this._updateStopButton();
  }

  // Stop the atmosphere loop only
  stopAtmosphere() {
    if (this._atmosphereAudio) {
      this._atmosphereAudio.pause();
      this._atmosphereAudio = null;
    }
    if (this._atmosphereUrl) {
      URL.revokeObjectURL(this._atmosphereUrl);
      this._atmosphereUrl = null;
    }
    if (this._atmosphereSource) {
      try { this._atmosphereSource.disconnect(); } catch { /* already gone */ }
      this._atmosphereSource = null;
    }
    this._atmosphereGain = null;
    this._updateStopButton();
    this._updateAtmosphereCard();
  }

  // Play the atmosphere loop through a dedicated gain node on the PA (right) channel
  async playAtmosphere() {
    const blob = await this.audioStorage.load(CUE_KEYS.atmosphere());
    if (!blob) return;

    this.stopAtmosphere();

    const ctx = this.audioManager.getContext();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = true;

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = this._atmosphereVolume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 1; // right = PA channel

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    this._atmosphereAudio = audio;
    this._atmosphereUrl = url;
    this._atmosphereSource = source;
    this._atmosphereGain = gain;

    try {
      await audio.play();
      this._updateStopButton();
      this._updateAtmosphereCard();
    } catch (err) {
      // Autoplay blocked — Web Audio context may need resuming
      this.stopAtmosphere();
    }
  }

  // Play a blob through Web Audio (right/PA channel), optionally looping
  async _playBlob(blob, loop = false) {
    this.stopMusic();

    const ctx = this.audioManager.getContext();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = loop;

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 1; // right = PA channel

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    this._activeAudio = audio;
    this._activeUrl = url;
    this._activeSource = source;

    audio.onended = () => {
      if (!loop) {
        URL.revokeObjectURL(url);
        this._activeAudio = null;
        this._activeUrl = null;
        this._activeSource = null;
        this._updateStopButton();
      }
    };

    try {
      await audio.play();
      this._updateStopButton();
    } catch (err) {
      // Autoplay blocked — Web Audio context may need resuming
      this.stopMusic();
    }
  }

  // Preview a cue on the LEFT (headphone) channel
  async _previewBlob(blob) {
    this.stopMusic();
    const ctx = this.audioManager.getContext();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    const panner = ctx.createStereoPanner();
    panner.pan.value = -1; // left = preview/headphone channel

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    this._activeAudio = audio;
    this._activeUrl = url;
    this._activeSource = source;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      this._activeAudio = null;
      this._activeUrl = null;
      this._activeSource = null;
      this._updateStopButton();
    };

    try {
      await audio.play();
      this._updateStopButton();
    } catch (err) {
      this.stopMusic();
    }
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  async init() {
    // Load stored keys to populate cueStatus
    const keys = await this.audioStorage.getAllKeys();
    keys.forEach(k => { this.cueStatus[k] = true; });
    this.render();
    this._bindStopButton();
  }

  // ─── UI Render ────────────────────────────────────────────────────────────

  async render() {
    const container = document.getElementById('music-tab');
    if (!container) return;

    const goalHorn = await this.audioStorage.has(CUE_KEYS.goalHorn());
    const timeout = await this.audioStorage.has(CUE_KEYS.timeout());
    const atmosphere = await this.audioStorage.has(CUE_KEYS.atmosphere());

    const anyActive = !!this._activeAudio || !!this._atmosphereAudio;

    container.innerHTML = `
      <div class="music-container">
        <div class="music-section-label">Auto-triggered Cues</div>
        <div class="music-hint-text">These play automatically on the PA (right) channel when the corresponding event is announced.</div>

        ${this._renderCueCard('goal-horn', '🎺', 'Goal Horn', 'Plays once on every goal', goalHorn)}
        ${this._renderCueCard('timeout-music', '⏸', 'Timeout Music', 'Loops during timeouts — tap Stop to end', timeout)}

        <div class="music-section-label" style="margin-top:24px;">Atmosphere</div>
        <div class="music-hint-text">Crowd noise loop — start manually at gate open, runs on PA alongside announcements.</div>

        ${this._renderAtmosphereCard(atmosphere)}

        <button id="stop-music-btn" class="stop-music-btn${anyActive ? ' active' : ''}">■ Stop All Music</button>

        <div class="music-section-label" style="margin-top:24px;">Walkup Songs</div>
        <div class="music-hint-text">Plays on PA when a player is tapped. Stops automatically when ▶ PLAY is pressed.</div>

        ${this._renderWalkupSection()}
      </div>
    `;

    this._bindCueCard('goal-horn', CUE_KEYS.goalHorn());
    this._bindCueCard('timeout-music', CUE_KEYS.timeout());
    this._bindAtmosphereCard();
    this._bindWalkupEvents();
    this._bindStopButton();
  }

  _renderCueCard(id, icon, title, subtitle, hasFile) {
    return `
      <div class="music-card" id="card-${id}">
        <div class="music-card-header">
          <span class="music-card-icon">${icon}</span>
          <div class="music-card-meta">
            <div class="music-card-title">${title}</div>
            <div class="music-card-sub">${subtitle}</div>
          </div>
          <span class="music-status-badge ${hasFile ? 'loaded' : 'empty'}">${hasFile ? 'Loaded' : 'No file'}</span>
        </div>
        <div class="music-card-actions">
          <button class="music-btn upload" data-cue="${id}">⬆ Upload</button>
          <button class="music-btn preview" data-cue="${id}" ${!hasFile ? 'disabled' : ''}>▶ Preview</button>
          <button class="music-btn clear danger" data-cue="${id}" ${!hasFile ? 'disabled' : ''}>✕ Clear</button>
        </div>
        <input type="file" class="music-file-input" id="file-${id}" data-cue="${id}" accept="audio/*" style="display:none">
      </div>
    `;
  }

  _renderAtmosphereCard(hasFile) {
    const isPlaying = !!this._atmosphereAudio;
    const vol = Math.round(this._atmosphereVolume * 100);
    return `
      <div class="music-card" id="card-atmosphere">
        <div class="music-card-header">
          <span class="music-card-icon">🏟️</span>
          <div class="music-card-meta">
            <div class="music-card-title">Atmosphere</div>
            <div class="music-card-sub">Crowd noise — runs alongside announcements, adjust volume as needed</div>
          </div>
          <span class="music-status-badge ${hasFile ? 'loaded' : 'empty'}">${hasFile ? 'Loaded' : 'No file'}</span>
        </div>
        <div class="music-card-actions">
          <button class="music-btn upload" data-cue="atmosphere">⬆ Upload</button>
          <button class="music-btn preview" data-cue="atmosphere" ${!hasFile ? 'disabled' : ''}>▶ Preview</button>
          <button class="music-btn ${isPlaying ? 'stop-atm' : 'play-atm'}" data-cue="atmosphere" ${!hasFile ? 'disabled' : ''}>${isPlaying ? '■ Stop' : '▶ Play'}</button>
          <button class="music-btn clear danger" data-cue="atmosphere" ${!hasFile ? 'disabled' : ''}>✕ Clear</button>
        </div>
        <div class="atmosphere-volume-row">
          <label class="atmosphere-vol-label">Volume</label>
          <input type="range" id="atmosphere-volume" min="0" max="100" value="${vol}" class="atmosphere-vol-slider" ${!hasFile ? 'disabled' : ''}>
          <span class="atmosphere-vol-value" id="atmosphere-vol-value">${vol}%</span>
        </div>
        <input type="file" class="music-file-input" id="file-atmosphere" accept="audio/*" style="display:none">
      </div>
    `;
  }

  _renderWalkupSection() {
    const home = this.gameState?.homeTeam;
    const away = this.gameState?.awayTeam;
    const homeRoster = this.gameState?.homeRoster || [];
    const awayRoster = this.gameState?.awayRoster || [];

    const renderTeam = (roster, team, teamData) => {
      if (!roster.length) return `<div class="music-hint-text" style="padding:10px 0">No players in ${team} roster.</div>`;
      return roster.map(p => {
        const key = CUE_KEYS.walkup(team, p.number);
        const has = !!this.cueStatus[key];
        const name = `${p.firstName} ${p.lastName}`.trim() || `#${p.number}`;
        return `
          <div class="walkup-row" data-team="${team}" data-number="${p.number}">
            <span class="walkup-number ${team}">#${p.number}</span>
            <span class="walkup-name">${name}</span>
            <span class="music-status-badge ${has ? 'loaded' : 'empty'} small">${has ? '♪' : '—'}</span>
            <button class="music-btn upload small" data-cue="walkup-${team}-${p.number}" data-team="${team}" data-player="${p.number}">⬆</button>
            <button class="music-btn clear danger small" data-cue="walkup-${team}-${p.number}" data-team="${team}" data-player="${p.number}" ${!has ? 'disabled' : ''}>✕</button>
            <input type="file" class="music-file-input" id="file-walkup-${team}-${p.number}" accept="audio/*" style="display:none">
          </div>
        `;
      }).join('');
    };

    return `
      <div class="walkup-team-block">
        <div class="walkup-team-header home">${home?.mascot || home?.name || 'Home'}</div>
        ${renderTeam(homeRoster, 'home', home)}
      </div>
      <div class="walkup-team-block">
        <div class="walkup-team-header away">${away?.mascot || away?.name || 'Away'}</div>
        ${renderTeam(awayRoster, 'away', away)}
      </div>
    `;
  }

  // ─── Event Binding ────────────────────────────────────────────────────────

  _bindCueCard(id, storageKey) {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;

    card.querySelector(`.music-btn.upload[data-cue="${id}"]`)?.addEventListener('click', () => {
      document.getElementById(`file-${id}`)?.click();
    });

    document.getElementById(`file-${id}`)?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.audioStorage.save(storageKey, file);
      e.target.value = '';
      await this.render();
    });

    card.querySelector(`.music-btn.preview[data-cue="${id}"]`)?.addEventListener('click', async () => {
      const blob = await this.audioStorage.load(storageKey);
      if (blob) await this._previewBlob(blob);
    });

    card.querySelector(`.music-btn.clear[data-cue="${id}"]`)?.addEventListener('click', async () => {
      await this.audioStorage.remove(storageKey);
      delete this.cueStatus[storageKey];
      await this.render();
    });
  }

  _bindWalkupEvents() {
    const container = document.getElementById('music-tab');
    if (!container) return;

    // Upload buttons for walkup rows
    container.querySelectorAll('.walkup-row .music-btn.upload').forEach(btn => {
      const team = btn.dataset.team;
      const number = btn.dataset.player;
      const fileInput = document.getElementById(`file-walkup-${team}-${number}`);

      btn.addEventListener('click', () => fileInput?.click());

      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const key = CUE_KEYS.walkup(team, number);
        await this.audioStorage.save(key, file);
        this.cueStatus[key] = true;
        e.target.value = '';
        await this.render();
      });
    });

    // Clear buttons for walkup rows
    container.querySelectorAll('.walkup-row .music-btn.clear').forEach(btn => {
      const team = btn.dataset.team;
      const number = btn.dataset.player;
      btn.addEventListener('click', async () => {
        const key = CUE_KEYS.walkup(team, number);
        await this.audioStorage.remove(key);
        delete this.cueStatus[key];
        await this.render();
      });
    });
  }

  _bindAtmosphereCard() {
    const card = document.getElementById('card-atmosphere');
    if (!card) return;

    card.querySelector('.music-btn.upload[data-cue="atmosphere"]')?.addEventListener('click', () => {
      document.getElementById('file-atmosphere')?.click();
    });

    document.getElementById('file-atmosphere')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.audioStorage.save(CUE_KEYS.atmosphere(), file);
      this.cueStatus[CUE_KEYS.atmosphere()] = true;
      e.target.value = '';
      await this.render();
    });

    card.querySelector('.music-btn.preview[data-cue="atmosphere"]')?.addEventListener('click', async () => {
      const blob = await this.audioStorage.load(CUE_KEYS.atmosphere());
      if (blob) await this._previewBlob(blob);
    });

    // Play/Stop toggle — class is either play-atm or stop-atm depending on state at render time
    card.querySelector('.music-btn[data-cue="atmosphere"].play-atm, .music-btn[data-cue="atmosphere"].stop-atm')
      ?.addEventListener('click', async () => {
        if (this._atmosphereAudio) {
          this.stopAtmosphere();
        } else {
          await this.playAtmosphere();
        }
      });

    card.querySelector('.music-btn.clear.danger[data-cue="atmosphere"]')?.addEventListener('click', async () => {
      this.stopAtmosphere();
      await this.audioStorage.remove(CUE_KEYS.atmosphere());
      delete this.cueStatus[CUE_KEYS.atmosphere()];
      await this.render();
    });

    document.getElementById('atmosphere-volume')?.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value) / 100;
      this._atmosphereVolume = vol;
      const label = document.getElementById('atmosphere-vol-value');
      if (label) label.textContent = `${e.target.value}%`;
      if (this._atmosphereGain) {
        this._atmosphereGain.gain.value = vol;
      }
    });
  }

  // Update the atmosphere card's play/stop button in-place without a full re-render
  _updateAtmosphereCard() {
    const card = document.getElementById('card-atmosphere');
    if (!card) return;
    const isPlaying = !!this._atmosphereAudio;
    const btn = card.querySelector('.music-btn.play-atm, .music-btn.stop-atm');
    if (btn) {
      btn.className = `music-btn ${isPlaying ? 'stop-atm' : 'play-atm'}`;
      btn.textContent = isPlaying ? '■ Stop' : '▶ Play';
    }
  }

  _bindStopButton() {
    const btn = document.getElementById('stop-music-btn');
    if (btn) {
      // Replace event listener to avoid duplicates
      const newBtn = btn.cloneNode(true);
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        this.stopMusic();      // stops cue track (walkup / goal horn / timeout)
        this.stopAtmosphere(); // stops atmosphere loop
      });
    }
  }

  _updateStopButton() {
    const btn = document.getElementById('stop-music-btn');
    if (btn) {
      const anyActive = !!this._activeAudio || !!this._atmosphereAudio;
      btn.classList.toggle('active', anyActive);
    }
  }
}
