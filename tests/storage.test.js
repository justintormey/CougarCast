// Tests for Storage — localStorage persistence layer
// Uses a Map-backed mock since Node has no native localStorage
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing Storage so the module sees the mock
const store = new Map();
global.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

// structuredClone is available in Node 17+; polyfill for safety
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

import { Storage } from '../js/storage.js';

describe('Storage', () => {
  let storage;

  beforeEach(() => {
    store.clear();
    storage = new Storage();
  });

  // ─── loadGame ───────────────────────────────────────────────────────────────

  describe('loadGame', () => {
    it('returns sample game on first run (empty localStorage)', () => {
      const game = storage.loadGame();
      expect(game).toBeDefined();
      expect(game.homeTeam).toBeDefined();
      expect(game.awayTeam).toBeDefined();
      expect(Array.isArray(game.homeRoster)).toBe(true);
      expect(Array.isArray(game.awayRoster)).toBe(true);
    });

    it('persists sample game to localStorage on first run', () => {
      storage.loadGame();
      const raw = localStorage.getItem('ainnouncr_game');
      expect(raw).not.toBeNull();
    });

    it('returns previously saved game', () => {
      const customGame = { homeTeam: { name: 'Test', mascot: 'T', color: '#fff', energy: 'high' }, homeScore: 5 };
      localStorage.setItem('ainnouncr_game', JSON.stringify(customGame));
      const game = storage.loadGame();
      expect(game.homeScore).toBe(5);
    });

    it('falls back to sample game when localStorage data is corrupted JSON', () => {
      localStorage.setItem('ainnouncr_game', 'not-valid-json{{{');
      const game = storage.loadGame();
      // Should not throw and should return something with the default structure
      expect(game).toBeDefined();
      expect(game.homeTeam).toBeDefined();
    });
  });

  // ─── saveGame ───────────────────────────────────────────────────────────────

  describe('saveGame', () => {
    it('persists game state to localStorage', () => {
      const game = { homeScore: 3, awayScore: 1, homeTeam: { name: 'A' }, awayTeam: { name: 'B' } };
      storage.saveGame(game);
      const raw = localStorage.getItem('ainnouncr_game');
      expect(JSON.parse(raw).homeScore).toBe(3);
    });
  });

  // ─── API key ─────────────────────────────────────────────────────────────────

  describe('getApiKey / setApiKey', () => {
    it('returns empty string when no key is set', () => {
      expect(storage.getApiKey()).toBe('');
    });

    it('stores and retrieves an API key', () => {
      storage.setApiKey('test-key-abc123');
      expect(storage.getApiKey()).toBe('test-key-abc123');
    });

    it('removes the key when called with empty string', () => {
      storage.setApiKey('some-key');
      storage.setApiKey('');
      expect(storage.getApiKey()).toBe('');
    });

    it('removes the key when called with null', () => {
      storage.setApiKey('some-key');
      storage.setApiKey(null);
      expect(storage.getApiKey()).toBe('');
    });
  });

  // ─── Voice ID ────────────────────────────────────────────────────────────────

  describe('getVoiceId / setVoiceId', () => {
    it('returns empty string when no voice is set', () => {
      expect(storage.getVoiceId()).toBe('');
    });

    it('stores and retrieves a voice ID', () => {
      storage.setVoiceId('voice-xyz-789');
      expect(storage.getVoiceId()).toBe('voice-xyz-789');
    });

    it('removes the voice when called with empty string', () => {
      storage.setVoiceId('a-voice');
      storage.setVoiceId('');
      expect(storage.getVoiceId()).toBe('');
    });
  });

  // ─── clear ───────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes game data from localStorage', () => {
      storage.saveGame({ homeScore: 99 });
      storage.clear();
      expect(localStorage.getItem('ainnouncr_game')).toBeNull();
    });

    it('does not clear API key (only game data)', () => {
      storage.setApiKey('keep-me');
      storage.saveGame({ homeScore: 1 });
      storage.clear();
      expect(storage.getApiKey()).toBe('keep-me');
    });
  });
});
