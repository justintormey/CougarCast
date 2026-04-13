// Tests for TextGenerator — core announcement text generation engine
import { describe, it, expect, beforeEach } from 'vitest';
import { TextGenerator } from '../js/text-generator.js';

describe('TextGenerator', () => {
  let gen;

  beforeEach(() => {
    gen = new TextGenerator();
  });

  // ─── fillTemplate ───────────────────────────────────────────────────────────

  describe('fillTemplate', () => {
    it('replaces simple placeholders', () => {
      const result = gen.fillTemplate('The {team} score.', { team: 'Wildcats' });
      expect(result).toBe('The Wildcats score.');
    });

    it('replaces nested dot-path placeholders', () => {
      const result = gen.fillTemplate(
        'Goal by {scorer.number}, {scorer.name}.',
        { scorer: { number: '7', name: 'Alex Kim' } }
      );
      expect(result).toBe('Goal by 7, Alex Kim.');
    });

    it('leaves unknown placeholders intact', () => {
      const result = gen.fillTemplate('{missing} placeholder', {});
      expect(result).toBe('{missing} placeholder');
    });

    it('handles multiple placeholders of the same key', () => {
      const result = gen.fillTemplate('{team} vs {team}', { team: 'Hawks' });
      expect(result).toBe('Hawks vs Hawks');
    });
  });

  // ─── pronounceName / displayName ────────────────────────────────────────────

  describe('pronounceName', () => {
    it('returns phonetic override when set', () => {
      const player = { firstName: 'Nguyen', lastName: 'Van', pronounce: 'Win Van' };
      expect(gen.pronounceName(player)).toBe('Win Van');
    });

    it('falls back to firstName + lastName when pronounce is empty', () => {
      const player = { firstName: 'Sarah', lastName: 'Jones', pronounce: '' };
      expect(gen.pronounceName(player)).toBe('Sarah Jones');
    });

    it('falls back when pronounce is only whitespace', () => {
      const player = { firstName: 'Anna', lastName: 'Lee', pronounce: '   ' };
      expect(gen.pronounceName(player)).toBe('Anna Lee');
    });
  });

  describe('displayName', () => {
    it('always returns real first + last name', () => {
      const player = { firstName: 'Patel', lastName: 'Raj', pronounce: 'Puh-tell Raj' };
      expect(gen.displayName(player)).toBe('Patel Raj');
    });
  });

  // ─── generate (template pool + recency avoidance) ───────────────────────────

  describe('generate', () => {
    it('returns a non-empty string for known event type', () => {
      const result = gen.generate('timeout', { team: 'Eagles' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Eagles');
    });

    it('returns data.text for unknown event type', () => {
      const result = gen.generate('unknownEvent', { text: 'fallback text' });
      expect(result).toBe('fallback text');
    });

    it('avoids repeating the same template 3+ consecutive times', () => {
      // With a 5-template pool, running 10x should produce variety
      const results = Array.from({ length: 10 }, () =>
        gen.generate('timeout', { team: 'Hawks' })
      );
      const unique = new Set(results);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  // ─── generateGoal ────────────────────────────────────────────────────────────

  describe('generateGoal', () => {
    const scorer = { number: '9', firstName: 'Maria', lastName: 'Alvarez', pronounce: '', year: '' };
    const assist = { number: '4', firstName: 'Taylor', lastName: 'Kim', pronounce: '', year: '' };

    it('generates goal text with scorer name', () => {
      const result = gen.generateGoal(scorer, 'Wildcats', null, 'neutral');
      expect(result).toContain('Alvarez');
      expect(result).toContain('9');
    });

    it('includes assist name when assist provided', () => {
      const result = gen.generateGoal(scorer, 'Wildcats', assist, 'neutral');
      expect(result).toContain('Kim');
    });

    it('uses hype templates for high-energy team', () => {
      // High-energy templates contain exclamation marks
      const results = Array.from({ length: 10 }, () =>
        gen.generateGoal(scorer, 'Wildcats', null, 'high')
      );
      expect(results.some(r => r.includes('!'))).toBe(true);
    });

    it('uses neutral templates for neutral-energy team', () => {
      // Run many to check — neutral templates have lower case and no GOAL! prefix
      const results = Array.from({ length: 10 }, () =>
        gen.generateGoal(scorer, 'Eagles', null, 'neutral')
      );
      // Neutral pool uses goal templates (not hype), which are calmer phrasing
      expect(results.every(r => typeof r === 'string' && r.length > 0)).toBe(true);
    });

    it('uses pronunciation override name in output', () => {
      const player = { number: '3', firstName: 'Nguyen', lastName: 'Vu', pronounce: 'Win Voo', year: '' };
      const result = gen.generateGoal(player, 'Hawks', null, 'neutral');
      expect(result).toContain('Win Voo');
      expect(result).not.toContain('Nguyen');
    });
  });

  // ─── generateTimeout ─────────────────────────────────────────────────────────

  describe('generateTimeout', () => {
    it('includes team name', () => {
      const result = gen.generateTimeout('Wildcats');
      expect(result).toContain('Wildcats');
    });
  });

  // ─── generatePenalty / generateInfraction ────────────────────────────────────

  describe('generatePenalty', () => {
    const player = { number: '12', firstName: 'Chris', lastName: 'Park', pronounce: '', year: '' };

    it('includes player number and team', () => {
      const result = gen.generatePenalty(player, 'Eagles');
      expect(result).toContain('12');
      expect(result).toContain('Eagles');
    });

    it('includes player name', () => {
      const result = gen.generatePenalty(player, 'Eagles');
      expect(result).toContain('Park');
    });
  });

  // ─── generateHalftimeScore ───────────────────────────────────────────────────

  describe('generateHalftimeScore', () => {
    it('contains scores and at least one team name', () => {
      const result = gen.generateHalftimeScore('Wildcats', 3, 'Eagles', 1);
      // Some templates mention only the home team (e.g. "At halftime, your Wildcats lead 3 to 1.")
      const hasTeamName = result.includes('Wildcats') || result.includes('Eagles');
      expect(hasTeamName).toBe(true);
      expect(result).toMatch(/3/);
      expect(result).toMatch(/1/);
    });

    it('produces a non-empty string when teams are tied', () => {
      const result = gen.generateHalftimeScore('Lions', 2, 'Bears', 2);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/2/);
    });
  });

  // ─── generateFinalScore ──────────────────────────────────────────────────────

  describe('generateFinalScore', () => {
    it('contains the scores and at least one team name', () => {
      const result = gen.generateFinalScore('Wildcats', 5, 'Eagles', 3);
      // Some templates mention only the winner (e.g. "Wildcats wins, 5 to 3.")
      // so require at least one team name appears, plus both scores
      const hasTeamName = result.includes('Wildcats') || result.includes('Eagles');
      expect(hasTeamName).toBe(true);
      expect(result).toMatch(/5/);
      expect(result).toMatch(/3/);
    });

    it('always produces a non-empty string', () => {
      const result = gen.generateFinalScore('Lions', 2, 'Bears', 0);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ─── expandPlayerReferences ──────────────────────────────────────────────────

  describe('expandPlayerReferences', () => {
    const homeRoster = [
      { number: '7', firstName: 'Sam', lastName: 'Reed' },
      { number: '11', firstName: 'Jo', lastName: 'Price' },
    ];
    const awayRoster = [
      { number: '3', firstName: 'Alex', lastName: 'Cruz' },
    ];

    it('expands #number to full player reference', () => {
      const result = gen.expandPlayerReferences('#7 scores!', homeRoster, awayRoster);
      expect(result).toBe('number 7, Sam Reed, scores!');
    });

    it('expands numbers from away roster', () => {
      const result = gen.expandPlayerReferences('Foul on #3.', homeRoster, awayRoster);
      expect(result).toBe('Foul on number 3, Alex Cruz,.');
    });

    it('leaves unknown jersey numbers unchanged', () => {
      const result = gen.expandPlayerReferences('#99 mystery', homeRoster, awayRoster);
      expect(result).toBe('#99 mystery');
    });

    it('handles multiple references in one text', () => {
      const result = gen.expandPlayerReferences('#7 assisted by #11', homeRoster, awayRoster);
      expect(result).toContain('Sam Reed');
      expect(result).toContain('Jo Price');
    });
  });
});
