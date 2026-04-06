// Roster manager — renders rosters in Game tab, handles player selection

export class RosterManager {
  constructor(gameState, storage, onChanged) {
    this.gameState = gameState;
    this.storage = storage;
    this.onChanged = onChanged;
    this.onPlayerSelect = null; // callback set by SequenceBuilder
  }

  setGameState(gameState) {
    this.gameState = gameState;
  }

  renderRosters() {
    this.renderRoster('home', this.gameState.homeRoster, document.getElementById('home-roster-list'));
    this.renderRoster('away', this.gameState.awayRoster, document.getElementById('away-roster-list'));
  }

  renderRoster(team, roster, container) {
    container.innerHTML = roster.map((p, i) => {
      const name = `#${p.number} ${p.firstName} ${p.lastName}`;
      return `<div class="player-row" data-team="${team}" data-index="${i}" data-number="${p.number}">
        <span class="player-name">${name}</span>
        <span class="player-pos">${p.year || ''}</span>
      </div>`;
    }).join('');

    container.querySelectorAll('.player-row').forEach(row => {
      row.addEventListener('click', () => {
        const team = row.dataset.team;
        const index = parseInt(row.dataset.index);
        const roster = team === 'home' ? this.gameState.homeRoster : this.gameState.awayRoster;
        const player = roster[index];

        if (this.onPlayerSelect) {
          this.onPlayerSelect(player, team);
        }
      });
    });
  }

  getPlayerByNumber(number, team) {
    const roster = team === 'home' ? this.gameState.homeRoster : this.gameState.awayRoster;
    return roster.find(p => p.number === String(number));
  }

  getTeamName(team) {
    const teamData = team === 'home' ? this.gameState.homeTeam : this.gameState.awayTeam;
    return teamData.mascot || teamData.name || (team === 'home' ? 'Home' : 'Visiting');
  }
}
