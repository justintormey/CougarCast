// Sequence Builder — chip accumulation, event interpretation, generate → preview → play flow

export class SequenceBuilder {
  constructor(gameState, textGenerator, tts, audioManager, onGameStateChanged) {
    this.gameState = gameState;
    this.textGenerator = textGenerator;
    this.tts = tts;
    this.audioManager = audioManager;
    this.onGameStateChanged = onGameStateChanged;

    this.chips = []; // { type: 'player'|'action'|'team', data: ... }
    this.generatedText = '';
    this.generatedAudio = null;
    this.generatedEnergy = 'neutral';
    this.isGenerating = false;
    this.lastInterpretation = null;  // captured before clear for music callbacks

    // Optional music callbacks (set by App after init)
    this.onPlayFired = null;     // () => void — called on every PLAY press before music cues
    this.onGoalScored = null;   // (team: string) => void
    this.onTimeoutCalled = null; // () => void

    this.setupEventListeners();
  }

  setGameState(gameState) {
    this.gameState = gameState;
    this.clear();
  }

  setupEventListeners() {
    // Action buttons
    this.bindActionButtons();

    // Clear button
    document.getElementById('clear-sequence').addEventListener('click', () => this.clear());

    // Custom text generate
    document.getElementById('custom-generate').addEventListener('click', () => this.generateCustom());
    document.getElementById('custom-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.generateCustom();
    });

    // Preview/Play
    document.getElementById('preview-btn').addEventListener('click', () => this.preview());
    document.getElementById('play-btn').addEventListener('click', () => this.play());

    // Roster header clicks (select team)
    document.getElementById('home-roster-header').addEventListener('click', () => {
      this.addTeamChip('home');
      this.tryGenerate();
    });
    document.getElementById('away-roster-header').addEventListener('click', () => {
      this.addTeamChip('away');
      this.tryGenerate();
    });
  }

  // Called by RosterManager when a player is tapped
  handlePlayerSelect(player, team) {
    // If custom input is open, insert player name at cursor
    const customBar = document.getElementById('custom-input-bar');
    if (customBar.style.display !== 'none') {
      this.insertPlayerInCustomField(player);
      return;
    }

    this.addPlayerChip(player, team);
    this.tryGenerate();
  }

  bindActionButtons() {
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'custom') {
          this.handleCustomAction();
        } else {
          const points = btn.dataset.points ? parseInt(btn.dataset.points) : null;
          this.addActionChip(action, btn.textContent.trim(), btn.style.background, points);
          this.tryGenerate();
        }
      });
    });
  }

  insertPlayerInCustomField(player) {
    const input = document.getElementById('custom-text');
    const name = `${player.firstName} ${player.lastName}`;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;

    // Insert name at cursor, adding a space before if needed
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needsSpace = before.length > 0 && !before.endsWith(' ');
    const inserted = (needsSpace ? ' ' : '') + name;

    input.value = before + inserted + after;
    // Move cursor to after inserted name
    const newPos = start + inserted.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();
  }

  addPlayerChip(player, team) {
    this.chips.push({
      type: 'player',
      data: { ...player, team },
      label: `#${player.number} ${player.firstName} ${player.lastName}`,
      cssClass: `player-chip ${team}`,
    });
    this.renderChips();
  }

  addTeamChip(team) {
    const teamData = team === 'home' ? this.gameState.homeTeam : this.gameState.awayTeam;
    const name = teamData.mascot || teamData.name || team;
    this.chips.push({
      type: 'team',
      data: { team, name },
      label: name.toUpperCase(),
      cssClass: `team-chip ${team}`,
    });
    this.renderChips();
  }

  addActionChip(action, label, color, points) {
    this.chips.push({
      type: 'action',
      data: { action, points },
      label: label || action.toUpperCase(),
      cssClass: `action-chip`,
      color: color || null,
    });
    this.renderChips();
  }

  handleCustomAction() {
    this.addActionChip('custom', 'CUSTOM');
    this.renderChips();
    const customBar = document.getElementById('custom-input-bar');
    customBar.style.display = 'flex';
    document.getElementById('custom-text').focus();
  }

  renderChips() {
    const container = document.getElementById('sequence-chips');
    container.innerHTML = this.chips.map((chip, i) => {
      const style = chip.color ? `style="background:${chip.color}"` : '';
      return `<span class="chip ${chip.cssClass}" data-index="${i}" ${style}>${chip.label}</span>`;
    }).join('');

    // Click to remove individual chip
    container.querySelectorAll('.chip').forEach(el => {
      el.addEventListener('click', () => {
        this.chips.splice(parseInt(el.dataset.index), 1);
        this.renderChips();
        this.generatedText = '';
        this.generatedAudio = null;
        this.updateAudioBar();
      });
    });
  }

  tryGenerate() {
    const interpretation = this.interpret();
    if (!interpretation) return;

    this.lastInterpretation = interpretation; // save before chips are cleared
    this.generatedText = interpretation.text;
    this.generatedEnergy = interpretation.energy || 'neutral';
    this.generatedAudio = null;
    this.updateAudioBar();
  }

  interpret() {
    const actions = this.chips.filter(c => c.type === 'action');
    const players = this.chips.filter(c => c.type === 'player');
    const teams = this.chips.filter(c => c.type === 'team');

    if (actions.length === 0 && players.length === 0 && teams.length === 0) return null;

    const action = actions[0]?.data.action;

    // Goal / scoring action (goal, goal1, goal2, goal3)
    const isScoring = action?.startsWith('goal') || actions.some(a => a.data.action?.startsWith('goal'));
    if (isScoring) {
      const scorer = players[0]?.data;
      if (!scorer) return null;

      const hasAssist = actions.some(a => a.data.action === 'assist');
      const assister = hasAssist ? players[1]?.data : null;
      const teamName = this.getTeamName(scorer.team);

      const teamData = scorer.team === 'home' ? this.gameState.homeTeam : this.gameState.awayTeam;
      const energy = teamData.energy || 'neutral';

      return {
        text: this.textGenerator.generateGoal(scorer, teamName, assister, energy),
        type: 'goal',
        energy,
        scorer,
        assister,
      };
    }

    // Assist without goal — treat first player as scorer hint
    if (action === 'assist' && players.length >= 1) {
      // Just an assist chip with a player — wait for more input
      return null;
    }

    // Timeout — neutral energy always
    if (action === 'timeout') {
      const teamChip = teams[0] || (players[0] ? { data: { team: players[0].data.team } } : null);
      if (!teamChip) return null;
      const teamName = this.getTeamName(teamChip.data.team);
      return {
        text: this.textGenerator.generateTimeout(teamName),
        type: 'timeout',
        energy: 'neutral',
      };
    }

    // Infractions — neutral energy always
    const infractionTypes = ['penalty', 'yellow-card', 'red-card', 'green-card', 'foul', 'tech-foul'];
    if (infractionTypes.includes(action)) {
      const player = players[0]?.data;
      if (!player) return null;
      const teamName = this.getTeamName(player.team);
      return {
        text: this.textGenerator.generateInfraction(action, player, teamName),
        type: 'infraction',
        energy: 'neutral',
      };
    }

    // No action but has players — might be building up, don't generate yet
    return null;
  }

  generateCustom() {
    const input = document.getElementById('custom-text');
    let text = input.value.trim();
    if (!text) return;

    // Expand jersey numbers to player names
    text = this.textGenerator.expandPlayerReferences(
      text,
      this.gameState.homeRoster,
      this.gameState.awayRoster
    );

    this.generatedText = text;
    this.generatedAudio = null;
    this.updateAudioBar();
  }

  updateAudioBar() {
    const textEl = document.getElementById('audio-text');
    const previewBtn = document.getElementById('preview-btn');
    const playBtn = document.getElementById('play-btn');

    if (this.generatedText) {
      textEl.textContent = `"${this.generatedText}"`;
      textEl.classList.add('has-text');
      previewBtn.disabled = false;
      playBtn.disabled = false;
    } else {
      textEl.textContent = 'Tap a player and an action to build an announcement...';
      textEl.classList.remove('has-text');
      previewBtn.disabled = true;
      playBtn.disabled = true;
    }
  }

  async generateAudio() {
    if (this.generatedAudio) return this.generatedAudio;
    if (!this.generatedText) return null;

    const previewBtn = document.getElementById('preview-btn');
    const playBtn = document.getElementById('play-btn');
    previewBtn.classList.add('loading');
    previewBtn.textContent = 'Generating...';
    playBtn.classList.add('loading');

    try {
      this.generatedAudio = await this.tts.generateAudio(this.generatedText, this.generatedEnergy);
      return this.generatedAudio;
    } catch (err) {
      document.getElementById('audio-text').textContent = `Error: ${err.message}`;
      return null;
    } finally {
      previewBtn.classList.remove('loading');
      previewBtn.textContent = 'PREVIEW';
      playBtn.classList.remove('loading');
    }
  }

  async preview() {
    const audio = await this.generateAudio();
    if (audio) {
      this.audioManager.preview(audio);
    }
  }

  async play() {
    const interp = this.lastInterpretation; // capture before clear
    const audio = await this.generateAudio();
    if (audio) {
      this.audioManager.play(audio);
      this.applyGameEffect();
      if (this.onPlayFired) this.onPlayFired(); // stop walkup (or any active music) on every PLAY
      this._triggerMusicCue(interp);
      this.clear();
    }
  }

  _triggerMusicCue(interp) {
    if (!interp) return;
    if (interp.type === 'goal' && this.onGoalScored) {
      this.onGoalScored(interp.scorer?.team);
    }
    if (interp.type === 'timeout' && this.onTimeoutCalled) {
      this.onTimeoutCalled();
    }
  }

  applyGameEffect() {
    // Any action starting with "goal" is a scoring action
    const actions = this.chips.filter(c => c.type === 'action');
    const players = this.chips.filter(c => c.type === 'player');
    const scoringAction = actions.find(a => a.data.action.startsWith('goal'));

    if (scoringAction && players.length > 0) {
      const team = players[0].data.team;
      const points = scoringAction.data.points || 1;
      if (team === 'home') {
        this.gameState.homeScore += points;
      } else {
        this.gameState.awayScore += points;
      }
      this.onGameStateChanged();
    }
  }

  clear() {
    this.chips = [];
    this.generatedText = '';
    this.generatedEnergy = 'neutral';
    this.generatedAudio = null;
    this.lastInterpretation = null;
    this.renderChips();
    this.updateAudioBar();
    document.getElementById('custom-input-bar').style.display = 'none';
    document.getElementById('custom-text').value = '';

    // Clear player selections in roster
    document.querySelectorAll('.player-row.selected').forEach(el => el.classList.remove('selected'));
  }

  getTeamName(team) {
    const teamData = team === 'home' ? this.gameState.homeTeam : this.gameState.awayTeam;
    return teamData.mascot || teamData.name || (team === 'home' ? 'Home' : 'Visiting');
  }
}
