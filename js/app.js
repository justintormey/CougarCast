// AInnouncR - Mike 2.0 v0.0.1
// Main app initialization and tab routing

import { Storage } from './storage.js';
import { RosterManager } from './roster.js';
import { SequenceBuilder } from './sequence-builder.js';
import { TextGenerator } from './text-generator.js';
import { ElevenLabsTTS } from './tts-elevenlabs.js';
import { AudioManager } from './audio-manager.js';
import { AnnouncementsManager } from './announcements.js';

const SPORT_PRESETS = {
  lacrosse: {
    label: 'Lacrosse',
    segments: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    pointsPerGoal: 1,
    actions: [
      { id: 'goal', label: 'GOAL', color: '#2e7d32' },
      { id: 'assist', label: 'ASSIST', color: '#1565c0' },
      { id: 'yellow-card', label: 'YELLOW CARD', color: '#f9a825', textColor: '#000' },
      { id: 'red-card', label: 'RED CARD', color: '#c62828' },
      { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '4 quarters, goals, assists, yellow/red cards, timeouts',
  },
  'field-hockey': {
    label: 'Field Hockey',
    segments: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    pointsPerGoal: 1,
    actions: [
      { id: 'goal', label: 'GOAL', color: '#2e7d32', points: 1 },
      { id: 'assist', label: 'ASSIST', color: '#1565c0' },
      { id: 'green-card', label: 'GREEN CARD', color: '#388e3c' },
      { id: 'yellow-card', label: 'YELLOW CARD', color: '#f9a825', textColor: '#000' },
      { id: 'red-card', label: 'RED CARD', color: '#c62828' },
      { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '4 quarters, goals, assists, green/yellow/red cards, timeouts',
  },
  'ice-hockey': {
    label: 'Ice Hockey',
    segments: ['P1', 'P2', 'P3', 'OT'],
    pointsPerGoal: 1,
    actions: [
      { id: 'goal', label: 'GOAL', color: '#2e7d32', points: 1 },
      { id: 'assist', label: 'ASSIST', color: '#1565c0' },
      { id: 'penalty', label: 'PENALTY', color: '#e65100' },
      { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '3 periods, goals, assists, penalties, timeouts',
  },
  soccer: {
    label: 'Soccer',
    segments: ['1st Half', '2nd Half', 'OT1', 'OT2'],
    pointsPerGoal: 1,
    actions: [
      { id: 'goal', label: 'GOAL', color: '#2e7d32', points: 1 },
      { id: 'assist', label: 'ASSIST', color: '#1565c0' },
      { id: 'yellow-card', label: 'YELLOW CARD', color: '#f9a825', textColor: '#000' },
      { id: 'red-card', label: 'RED CARD', color: '#c62828' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '2 halves, goals, assists, yellow/red cards',
  },
  basketball: {
    label: 'Basketball',
    segments: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    pointsPerGoal: 2,
    actions: [
      { id: 'goal', label: '2PT', color: '#2e7d32', points: 2 },
      { id: 'goal3', label: '3PT', color: '#1b5e20', points: 3 },
      { id: 'goal1', label: 'FT', color: '#4caf50', points: 1 },
      { id: 'assist', label: 'ASSIST', color: '#1565c0' },
      { id: 'foul', label: 'FOUL', color: '#e65100' },
      { id: 'tech-foul', label: 'TECH', color: '#c62828' },
      { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '4 quarters, 2pt/3pt/FT, assists, fouls, technicals, timeouts',
  },
  football: {
    label: 'Football',
    segments: ['Q1', 'Q2', 'Q3', 'Q4', 'OT'],
    pointsPerGoal: 6,
    actions: [
      { id: 'goal', label: 'TD', color: '#2e7d32', points: 6 },
      { id: 'goal1', label: 'XP', color: '#4caf50', points: 1 },
      { id: 'goal2', label: '2PT', color: '#1b5e20', points: 2 },
      { id: 'goal3', label: 'FG', color: '#558b2f', points: 3 },
      { id: 'penalty', label: 'FLAG', color: '#f9a825', textColor: '#000' },
      { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '4 quarters, TD/XP/2PT/FG, penalty flags, timeouts',
  },
  baseball: {
    label: 'Baseball / Softball',
    segments: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'],
    pointsPerGoal: 1,
    actions: [
      { id: 'goal', label: 'RUN', color: '#2e7d32', points: 1 },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: '9 innings (7 for softball), runs',
  },
  custom: {
    label: 'Custom',
    segments: null,
    pointsPerGoal: 1,
    actions: [
      { id: 'goal', label: 'GOAL', color: '#2e7d32', points: 1 },
      { id: 'assist', label: 'ASSIST', color: '#1565c0' },
      { id: 'penalty', label: 'PENALTY', color: '#e65100' },
      { id: 'timeout', label: 'TIMEOUT', color: '#37474f' },
      { id: 'custom', label: 'CUSTOM', color: '#616161' },
    ],
    description: 'Define your own segments and actions',
  },
};

class App {
  constructor() {
    this.storage = new Storage();
    this.textGenerator = new TextGenerator();
    this.tts = new ElevenLabsTTS(this.storage);
    this.audioManager = new AudioManager();
    this.gameState = null;
    this.rosterManager = null;
    this.sequenceBuilder = null;
    this.announcementsManager = null;
  }

  init() {
    this.gameState = this.storage.loadGame();
    this.rosterManager = new RosterManager(this.gameState, this.storage, () => this.onGameStateChanged());
    this.sequenceBuilder = new SequenceBuilder(
      this.gameState,
      this.textGenerator,
      this.tts,
      this.audioManager,
      () => this.onGameStateChanged()
    );
    this.announcementsManager = new AnnouncementsManager(
      this.gameState,
      this.storage,
      this.tts,
      this.audioManager
    );

    // Wire roster player taps to sequence builder
    this.rosterManager.onPlayerSelect = (player, team) => {
      this.sequenceBuilder.handlePlayerSelect(player, team);
    };

    this.setupTabs();
    this.setupSettings();
    this.renderGame();
    this.announcementsManager.render();
  }

  setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
      });
    });
  }

  setupSettings() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const close = document.getElementById('settings-close');

    btn.addEventListener('click', () => {
      this.populateSettings();
      modal.style.display = 'flex';
    });

    close.addEventListener('click', () => {
      this.saveSettings();
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.saveSettings();
        modal.style.display = 'none';
      }
    });

    // Voice refresh
    document.getElementById('refresh-voices').addEventListener('click', () => this.loadVoices());

    // Sport preset selector
    document.getElementById('sport-preset').addEventListener('change', (e) => {
      const preset = SPORT_PRESETS[e.target.value];
      document.getElementById('sport-description').textContent = preset?.description || '';
    });

    // Import/Export
    document.getElementById('export-btn').addEventListener('click', () => this.exportData());
    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', (e) => this.importData(e));
    document.getElementById('reset-btn').addEventListener('click', () => {
      if (confirm('Reset all data to sample game? This cannot be undone.')) {
        this.storage.clear();
        this.gameState = this.storage.loadGame();
        this.rosterManager.setGameState(this.gameState);
        this.sequenceBuilder.setGameState(this.gameState);
        this.announcementsManager.setGameState(this.gameState);
        this.renderGame();
        this.announcementsManager.render();
        this.populateSettings();
      }
    });

    // Add player buttons
    document.querySelectorAll('.add-player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const roster = team === 'home' ? this.gameState.homeRoster : this.gameState.awayRoster;
        roster.push({ number: '', firstName: '', lastName: '', pronounce: '', year: '' });
        this.renderRosterEdit();
      });
    });
  }

  populateSettings() {
    document.getElementById('elevenlabs-key').value = this.storage.getApiKey() || '';
    document.getElementById('home-name').value = this.gameState.homeTeam.name || '';
    document.getElementById('home-mascot').value = this.gameState.homeTeam.mascot || '';
    document.getElementById('home-color').value = this.gameState.homeTeam.color || '#1565c0';
    document.getElementById('home-energy').value = this.gameState.homeTeam.energy || 'high';
    document.getElementById('away-name').value = this.gameState.awayTeam.name || '';
    document.getElementById('away-mascot').value = this.gameState.awayTeam.mascot || '';
    document.getElementById('away-color').value = this.gameState.awayTeam.color || '#b71c1c';
    document.getElementById('away-energy').value = this.gameState.awayTeam.energy || 'neutral';
    document.getElementById('sport-preset').value = this.gameState.sport || 'lacrosse';
    const preset = SPORT_PRESETS[this.gameState.sport || 'lacrosse'];
    document.getElementById('sport-description').textContent = preset?.description || '';

    this.renderRosterEdit();

    if (this.storage.getApiKey()) {
      this.loadVoices();
    }
  }

  renderRosterEdit() {
    ['home', 'away'].forEach(team => {
      const container = document.getElementById(`roster-edit-${team}`);
      const roster = team === 'home' ? this.gameState.homeRoster : this.gameState.awayRoster;
      const label = document.getElementById(`roster-edit-${team}-label`);
      const teamData = team === 'home' ? this.gameState.homeTeam : this.gameState.awayTeam;
      label.textContent = `${teamData.name || (team === 'home' ? 'Home' : 'Visiting')} Roster`;

      const yearOptions = ['', 'Freshman', 'Sophomore', 'Junior', 'Senior'].map(y =>
        `<option value="${y}">${y || '—'}</option>`
      ).join('');

      container.innerHTML = roster.map((p, i) => {
        const yearSelect = yearOptions.replace(`value="${p.year || ''}"`, `value="${p.year || ''}" selected`);
        return `<div class="player-edit-row" data-team="${team}" data-index="${i}">
          <input type="text" class="num-input" value="${p.number}" placeholder="#" data-field="number">
          <input type="text" class="name-input" value="${p.firstName}" placeholder="First" data-field="firstName">
          <input type="text" class="name-input" value="${p.lastName}" placeholder="Last" data-field="lastName">
          <select class="year-select" data-field="year">${yearSelect}</select>
          <input type="text" class="pronounce-input" value="${p.pronounce || ''}" placeholder="Say as..." data-field="pronounce" title="Phonetic pronunciation (e.g., Nguyen → Win)">
          <button class="player-remove-btn" data-team="${team}" data-index="${i}">&times;</button>
        </div>`;
      }).join('');

      // Input and select change handlers
      container.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', (e) => {
          const row = e.target.closest('.player-edit-row');
          const idx = parseInt(row.dataset.index);
          const field = e.target.dataset.field;
          roster[idx][field] = e.target.value;
        });
      });

      // Remove handlers
      container.querySelectorAll('.player-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          roster.splice(parseInt(btn.dataset.index), 1);
          this.renderRosterEdit();
        });
      });
    });
  }

  saveSettings() {
    this.storage.setApiKey(document.getElementById('elevenlabs-key').value.trim());
    this.tts.setApiKey(this.storage.getApiKey());

    // Save sport
    this.gameState.sport = document.getElementById('sport-preset').value;

    this.gameState.homeTeam.name = document.getElementById('home-name').value.trim();
    this.gameState.homeTeam.mascot = document.getElementById('home-mascot').value.trim();
    this.gameState.homeTeam.color = document.getElementById('home-color').value;
    this.gameState.homeTeam.energy = document.getElementById('home-energy').value;
    this.gameState.awayTeam.name = document.getElementById('away-name').value.trim();
    this.gameState.awayTeam.mascot = document.getElementById('away-mascot').value.trim();
    this.gameState.awayTeam.color = document.getElementById('away-color').value;
    this.gameState.awayTeam.energy = document.getElementById('away-energy').value;

    // Parse game segments
    const selectedVoice = document.getElementById('voice-select').value;
    const previousVoice = this.storage.getVoiceId();
    if (selectedVoice) {
      this.storage.setVoiceId(selectedVoice);
      this.tts.setVoice(selectedVoice);
      // Clear pre-rendered audio if voice changed
      if (previousVoice && previousVoice !== selectedVoice) {
        this.announcementsManager.clearAudioCache();
      }
    }

    this.storage.saveGame(this.gameState);
    this.applyTeamColors();
    this.renderGame();
    this.announcementsManager.render();
  }

  async loadVoices() {
    const select = document.getElementById('voice-select');
    const apiKey = document.getElementById('elevenlabs-key').value.trim();
    if (!apiKey) {
      select.innerHTML = '<option value="">Enter API key first</option>';
      return;
    }

    select.innerHTML = '<option value="">Loading voices...</option>';
    this.tts.setApiKey(apiKey);

    const voices = await this.tts.listVoices();
    if (voices.length === 0) {
      select.innerHTML = '<option value="">No voices found (check API key)</option>';
      return;
    }

    const savedVoice = this.storage.getVoiceId();
    select.innerHTML = voices.map(v =>
      `<option value="${v.voice_id}" ${v.voice_id === savedVoice ? 'selected' : ''}>${v.name}</option>`
    ).join('');
  }

  applyTeamColors() {
    const root = document.documentElement;
    root.style.setProperty('--home-color', this.gameState.homeTeam.color);
    root.style.setProperty('--away-color', this.gameState.awayTeam.color);

    // Generate darker shade for headers
    const darken = (hex, amount) => {
      const num = parseInt(hex.slice(1), 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
      const b = Math.max(0, (num & 0x0000FF) - amount);
      return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    };
    root.style.setProperty('--home-dark', darken(this.gameState.homeTeam.color, 40));
    root.style.setProperty('--away-dark', darken(this.gameState.awayTeam.color, 40));
  }

  setupScoreAdjust() {
    // Only bind once — skip if already bound
    if (this._scoreAdjustBound) return;
    this._scoreAdjustBound = true;

    document.querySelectorAll('.score-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        const team = btn.dataset.team;
        const delta = parseInt(btn.dataset.delta);
        if (team === 'home') {
          this.gameState.homeScore = Math.max(0, this.gameState.homeScore + delta);
        } else {
          this.gameState.awayScore = Math.max(0, this.gameState.awayScore + delta);
        }
        this.onGameStateChanged();
      });
    });
  }

  updateActionButtons() {
    const sport = this.gameState.sport || 'lacrosse';
    const preset = SPORT_PRESETS[sport] || SPORT_PRESETS.lacrosse;
    const actionBar = document.querySelector('.action-bar');

    actionBar.innerHTML = preset.actions.map(a => {
      const textColor = a.textColor || 'white';
      const pts = a.points ? `data-points="${a.points}"` : '';
      return `<button class="action-btn" data-action="${a.id}" ${pts} style="background:${a.color};color:${textColor}">${a.label}</button>`;
    }).join('');

    // Re-bind click handlers via sequence builder
    this.sequenceBuilder.bindActionButtons();
  }

  renderGame() {
    this.applyTeamColors();

    // Team names
    const homeName = this.gameState.homeTeam.mascot || this.gameState.homeTeam.name || 'Home';
    const awayName = this.gameState.awayTeam.mascot || this.gameState.awayTeam.name || 'Visiting';

    document.getElementById('home-team-name').textContent = homeName;
    document.getElementById('away-team-name').textContent = awayName;
    document.getElementById('home-roster-header').textContent = homeName.toUpperCase();
    document.getElementById('away-roster-header').textContent = awayName.toUpperCase();

    // Scores
    this.updateScoreDisplay();

    // Action buttons (sport-specific)
    this.updateActionButtons();

    // Score adjust buttons
    this.setupScoreAdjust();

    // Rosters
    this.rosterManager.renderRosters();
  }

  updateScoreDisplay() {
    document.getElementById('home-team-score').textContent = this.gameState.homeScore;
    document.getElementById('away-team-score').textContent = this.gameState.awayScore;
  }

  onGameStateChanged() {
    this.updateScoreDisplay();
    this.storage.saveGame(this.gameState);
  }

  exportData() {
    const data = JSON.stringify(this.gameState, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ainnouncr-${this.gameState.homeTeam.mascot || 'home'}-vs-${this.gameState.awayTeam.mascot || 'away'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.gameState = data;
        this.storage.saveGame(this.gameState);
        this.rosterManager.setGameState(this.gameState);
        this.sequenceBuilder.setGameState(this.gameState);
        this.announcementsManager.setGameState(this.gameState);
        this.renderGame();
        this.announcementsManager.render();
        this.populateSettings();
        alert('Game data imported successfully!');
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
}

// Boot
const app = new App();
app.init();
