// Music Manager — cue file upload, storage, and playback
// Handles: goal horn, timeout music, per-player walkup songs
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

    // Active music playback
    this._activeAudio = null;
    this._activeUrl = null;
    this._activeSource = null;
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

    container.innerHTML = `
      <div class="music-container">
        <div class="music-section-label">Auto-triggered Cues</div>
        <div class="music-hint-text">These play automatically on the PA (right) channel when the corresponding event is announced.</div>

        ${this._renderCueCard('goal-horn', '🎺', 'Goal Horn', 'Plays once on every goal', goalHorn)}
        ${this._renderCueCard('timeout-music', '⏸', 'Timeout Music', 'Loops during timeouts — tap Stop to end', timeout)}

        <button id="stop-music-btn" class="stop-music-btn${this._activeAudio ? ' active' : ''}">■ Stop All Music</button>

        <div class="music-section-label" style="margin-top:24px;">Walkup Songs</div>
        <div class="music-hint-text">Plays on PA when a player is tapped. Stops automatically when ▶ PLAY is pressed.</div>

        ${this._renderWalkupSection()}
      </div>
    `;

    this._bindCueCard('goal-horn', CUE_KEYS.goalHorn());
    this._bindCueCard('timeout-music', CUE_KEYS.timeout());
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

  _bindStopButton() {
    const btn = document.getElementById('stop-music-btn');
    if (btn) {
      // Replace event listener to avoid duplicates
      const newBtn = btn.cloneNode(true);
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => this.stopMusic());
    }
  }

  _updateStopButton() {
    const btn = document.getElementById('stop-music-btn');
    if (btn) {
      btn.classList.toggle('active', !!this._activeAudio);
    }
  }
}
