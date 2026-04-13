// Tests for RosterManager utility methods (non-DOM)
// renderRosters/renderRoster require a live DOM — those are integration-level.
// getPlayerByNumber and getTeamName are pure data lookups worth unit testing.
import { describe, it, expect } from 'vitest';
import { RosterManager } from '../js/roster.js';

// Minimal DOM stub so the module import doesn't crash (it references document nowhere
// in these paths, but guard against future changes)
if (typeof global.document === 'undefined') {
  global.document = { getElementById: () => null };
}

const makeGameState = (overrides = {}) => ({
  homeTeam: { name: 'Home Team', mascot: 'Wildcats', color: '#0f0', energy: 'high' },
  awayTeam: { name: 'Visiting Team', mascot: '', color: '#f00', energy: 'neutral' },
  homeRoster: [
    { number: '7', firstName: 'Sam', lastName: 'Reed', pronounce: '', year: 'Senior' },
    { number: '11', firstName: 'Jo', lastName: 'Price', pronounce: '', year: 'Junior' },
  ],
  awayRoster: [
    { number: '3', firstName: 'Alex', lastName: 'Cruz', pronounce: '', year: 'Sophomore' },
    { number: '7', firstName: 'Riley', lastName: 'Stone', pronounce: '', year: '' },
  ],
  homeScore: 0,
  awayScore: 0,
  ...overrides,
});

describe('RosterManager', () => {
  // ─── getPlayerByNumber ───────────────────────────────────────────────────────

  describe('getPlayerByNumber', () => {
    it('finds a home player by jersey number', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      const player = rm.getPlayerByNumber('7', 'home');
      expect(player).toBeDefined();
      expect(player.firstName).toBe('Sam');
    });

    it('finds an away player by jersey number', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      const player = rm.getPlayerByNumber('3', 'away');
      expect(player).toBeDefined();
      expect(player.firstName).toBe('Alex');
    });

    it('returns undefined for non-existent number', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      expect(rm.getPlayerByNumber('99', 'home')).toBeUndefined();
    });

    it('coerces numeric input to string for comparison', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      // Pass number as integer — should still match '7' stored as string
      const player = rm.getPlayerByNumber(7, 'home');
      expect(player).toBeDefined();
      expect(player.number).toBe('7');
    });

    it('same jersey number on home vs away resolves to correct player', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      const homePlayer = rm.getPlayerByNumber('7', 'home');
      const awayPlayer = rm.getPlayerByNumber('7', 'away');
      expect(homePlayer.lastName).toBe('Reed');
      expect(awayPlayer.lastName).toBe('Stone');
    });
  });

  // ─── getTeamName ─────────────────────────────────────────────────────────────

  describe('getTeamName', () => {
    it('returns mascot when mascot is set', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      expect(rm.getTeamName('home')).toBe('Wildcats');
    });

    it('falls back to team name when mascot is empty', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      // awayTeam has empty mascot, should fall back to name
      expect(rm.getTeamName('away')).toBe('Visiting Team');
    });

    it('falls back to "Home" when both name and mascot are empty', () => {
      const gs = makeGameState();
      gs.homeTeam.mascot = '';
      gs.homeTeam.name = '';
      const rm = new RosterManager(gs, null, () => {});
      expect(rm.getTeamName('home')).toBe('Home');
    });

    it('falls back to "Visiting" for away when both name and mascot are empty', () => {
      const gs = makeGameState();
      gs.awayTeam.mascot = '';
      gs.awayTeam.name = '';
      const rm = new RosterManager(gs, null, () => {});
      expect(rm.getTeamName('away')).toBe('Visiting');
    });
  });

  // ─── setGameState ────────────────────────────────────────────────────────────

  describe('setGameState', () => {
    it('updates the internal game state reference', () => {
      const rm = new RosterManager(makeGameState(), null, () => {});
      const newState = makeGameState({ homeRoster: [] });
      rm.setGameState(newState);
      expect(rm.getPlayerByNumber('7', 'home')).toBeUndefined();
    });
  });
});
