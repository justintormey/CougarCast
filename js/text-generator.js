// Template-based text generation with randomized phrasing
// Avoids repeating the last 3 used templates per event type

export class TextGenerator {
  constructor() {
    this.recentTemplates = {}; // { eventType: [lastUsedIndex, ...] }
    this.templates = {
      // Neutral goal templates — factual, no commentary
      goal: [
        "Goal by number {scorer.number}, {scorer.name}, for the {team}.",
        "Number {scorer.number}, {scorer.name}, scores for the {team}.",
        "The {team} score. Number {scorer.number}, {scorer.name}, with the goal.",
        "{scorer.name}, number {scorer.number}, scores for the {team}.",
        "Goal, {team}. Number {scorer.number}, {scorer.name}.",
      ],
      goalWithAssist: [
        "Goal by number {scorer.number}, {scorer.name}. Assist by number {assist.number}, {assist.name}.",
        "Number {scorer.number}, {scorer.name}, scores for the {team}. Assisted by number {assist.number}, {assist.name}.",
        "The {team} score. {scorer.name}, number {scorer.number}, with the goal. {assist.name} with the assist.",
        "Goal, {team}. {scorer.name} scores, assisted by {assist.name}.",
        "{scorer.name}, number {scorer.number}, for the {team}. The assist goes to number {assist.number}, {assist.name}.",
      ],
      timeout: [
        "The {team} call a timeout.",
        "Timeout called by the {team}.",
        "The {team} take a timeout.",
        "We have a timeout on the field, called by the {team}.",
        "Play stops as the {team} call for a timeout.",
      ],
      penalty: [
        "Penalty on number {player.number}, {player.name}, of the {team}.",
        "We have a penalty. Number {player.number}, {player.name}, {team}.",
        "That's a penalty on the {team}. Number {player.number}, {player.name}.",
        "Penalty called on {player.name}, number {player.number}, of the {team}.",
        "The {team} are assessed a penalty. Number {player.number}, {player.name}.",
      ],
      'yellow-card': [
        "Yellow card issued to number {player.number}, {player.name}, of the {team}.",
        "That's a yellow card on the {team}. Number {player.number}, {player.name}.",
        "Number {player.number}, {player.name}, receives a yellow card.",
        "Yellow card. {player.name}, number {player.number}, of the {team}.",
      ],
      'red-card': [
        "Red card! Number {player.number}, {player.name}, of the {team} has been ejected.",
        "That's a red card on {player.name}, number {player.number}. The {team} are down a player.",
        "Number {player.number}, {player.name}, receives a red card and is ejected from the game.",
        "Red card issued to {player.name} of the {team}. Number {player.number} must leave the field.",
      ],
      'green-card': [
        "Green card warning issued to number {player.number}, {player.name}, of the {team}.",
        "That's a green card on {player.name}, number {player.number}, of the {team}.",
        "Number {player.number}, {player.name}, receives a green card warning.",
      ],
      foul: [
        "Foul called on number {player.number}, {player.name}, of the {team}.",
        "That's a foul on the {team}. Number {player.number}, {player.name}.",
        "Personal foul. Number {player.number}, {player.name}, {team}.",
        "Foul on {player.name}, number {player.number}, of the {team}.",
      ],
      'tech-foul': [
        "Technical foul called on number {player.number}, {player.name}, of the {team}.",
        "That's a technical foul on {player.name}, number {player.number}.",
        "Technical foul. Number {player.number}, {player.name}, {team}.",
      ],
      periodEnd: [
        "That marks the end of the {period}.",
        "And that's the end of the {period}.",
        "The {period} comes to a close.",
      ],
      // Mid-game period score — for quarter and period breaks
      periodScore: [
        "End of the {period}. {homeTeam} {homeScore}, {awayTeam} {awayScore}.",
        "That's the end of the {period}. Score: {leadTeam} {leadScore}, {trailTeam} {trailScore}.",
        "End of {period}. {homeTeam} {homeVerb} {leadScore} to {trailScore}.",
        "The {period} is over. {homeTeam} {homeScore}, {awayTeam} {awayScore}.",
        "After the {period}, it's {homeTeam} {homeScore}, {awayTeam} {awayScore}.",
      ],
      halftimeScore: [
        "At the half, it's the {leadTeam} {leadScore}, the {trailTeam} {trailScore}.",
        "Halftime score: {homeTeam} {homeScore}, {awayTeam} {awayScore}.",
        "We've reached halftime with the {homeTeam} {homeVerbParticiple} {homeScore} to {awayScore}.",
        "At halftime, your {homeTeam} {homeVerbParticiple} {homeScore} to {awayScore}.",
      ],
      finalScore: [
        "Final score: {homeTeam} {homeScore}, {awayTeam} {awayScore}.",
        "That's the final! {winTeam} wins, {winScore} to {loseScore}.",
        "And that's the game! Final score, {homeTeam} {homeScore}, {awayTeam} {awayScore}.",
      ],
      // High-energy templates for home team
      goalHype: [
        "GOAL! Number {scorer.number}, {scorer.name}, scores for the {team}!",
        "What a shot! {scorer.name}, number {scorer.number}, puts one in! The {team} score!",
        "Oh what a play! Number {scorer.number}, {scorer.name}, finds the back of the net for the {team}!",
        "The {team} strike again! {scorer.name} with a huge goal!",
        "Unbelievable! {scorer.name}, number {scorer.number}, with a fantastic goal for the {team}!",
        "And the crowd goes wild! Number {scorer.number}, {scorer.name}, scores!",
      ],
      goalWithAssistHype: [
        "GOAL! Number {scorer.number}, {scorer.name}, scores for the {team}! Great assist by number {assist.number}, {assist.name}!",
        "What a play! {assist.name} finds {scorer.name} and it's in the net! Goal, {team}!",
        "The {team} connect beautifully! {assist.name} to {scorer.name} for the score!",
        "Oh what a goal! Number {scorer.number}, {scorer.name}, finishes it off! Terrific feed from {assist.name}!",
        "The {team} are on fire! {scorer.name} scores with the assist from {assist.name}!",
        "Incredible teamwork! {assist.name} sets up {scorer.name} and it's GOAL, {team}!",
      ],
    };
  }

  generate(eventType, data) {
    const pool = this.templates[eventType];
    if (!pool) return data.text || '';
    return this.generateFromPool(eventType, pool, data);
  }

  generateFromPool(eventType, pool, data) {

    // Pick a random template, avoiding recent ones
    const recent = this.recentTemplates[eventType] || [];
    let available = pool.map((_, i) => i).filter(i => !recent.includes(i));
    if (available.length === 0) available = pool.map((_, i) => i);

    const chosenIndex = available[Math.floor(Math.random() * available.length)];

    // Track recent
    recent.push(chosenIndex);
    if (recent.length > 3) recent.shift();
    this.recentTemplates[eventType] = recent;

    return this.fillTemplate(pool[chosenIndex], data);
  }

  fillTemplate(template, data) {
    return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, path) => {
      const value = path.split('.').reduce((obj, key) => obj?.[key], data);
      return value !== undefined ? value : match;
    });
  }

  // Get the pronunciation name for TTS (falls back to display name)
  pronounceName(player) {
    if (player.pronounce && player.pronounce.trim()) {
      return player.pronounce.trim();
    }
    return `${player.firstName} ${player.lastName}`;
  }

  // Get display name (always real name, for UI text)
  displayName(player) {
    return `${player.firstName} ${player.lastName}`;
  }

  // Occasionally append year info (~30% chance when year is set)
  maybeAddYear(text, player) {
    if (!player.year || Math.random() > 0.3) return text;
    const yearPhrases = [
      `, a ${player.year.toLowerCase()}.`,
      `. The ${player.year.toLowerCase()} having a great game.`,
      `, the ${player.year.toLowerCase()} from the ${player.team || 'team'}.`,
    ];
    // Replace trailing period/exclamation with year phrase
    const phrase = yearPhrases[Math.floor(Math.random() * yearPhrases.length)];
    return text.replace(/[.!]$/, '') + phrase;
  }

  generateGoal(scorer, team, assist, energy) {
    const teamName = team;
    let text;
    if (assist) {
      const templateType = energy === 'high' ? 'goalWithAssistHype' : 'goalWithAssist';
      const pool = this.templates[templateType] || this.templates.goalWithAssist;
      text = this.generateFromPool(templateType, pool, {
        scorer: { number: scorer.number, name: this.pronounceName(scorer) },
        assist: { number: assist.number, name: this.pronounceName(assist) },
        team: teamName,
      });
    } else {
      const templateType = energy === 'high' ? 'goalHype' : 'goal';
      const pool = this.templates[templateType] || this.templates.goal;
      text = this.generateFromPool(templateType, pool, {
        scorer: { number: scorer.number, name: this.pronounceName(scorer) },
        team: teamName,
      });
    }
    return this.maybeAddYear(text, { ...scorer, team: teamName });
  }

  generateTimeout(teamName) {
    return this.generate('timeout', { team: teamName });
  }

  generatePenalty(player, teamName) {
    return this.generateInfraction('penalty', player, teamName);
  }

  generateInfraction(type, player, teamName) {
    return this.generate(type, {
      player: { number: player.number, name: this.pronounceName(player) },
      team: teamName,
    });
  }

  // Generate a score announcement for any period/quarter break
  generatePeriodScore(periodName, homeTeam, homeScore, awayTeam, awayScore) {
    const tied = homeScore === awayScore;
    const homeLeads = homeScore > awayScore;
    const leading = homeLeads ? homeTeam : awayTeam;
    const trailing = homeLeads ? awayTeam : homeTeam;
    const leadScore = Math.max(homeScore, awayScore);
    const trailScore = Math.min(homeScore, awayScore);

    // If it's a halftime-named period or a tie, use different phrasing
    const isHalf = /half/i.test(periodName);
    const templateType = isHalf ? 'halftimeScore' : 'periodScore';

    return this.generate(templateType, {
      period: periodName,
      homeTeam, homeScore, awayTeam, awayScore,
      leadTeam: tied ? homeTeam : leading,
      trailTeam: tied ? awayTeam : trailing,
      leadScore, trailScore,
      homeVerb: homeLeads ? 'lead' : homeScore < awayScore ? 'trail' : 'are tied',
      homeVerbParticiple: homeLeads ? 'leading' : homeScore < awayScore ? 'trailing' : 'tied',
    });
  }

  generateHalftimeScore(homeTeam, homeScore, awayTeam, awayScore) {
    const leading = homeScore >= awayScore;
    const homeVerb = homeScore > awayScore ? 'lead' : homeScore < awayScore ? 'trail' : 'are tied';
    const homeVerbParticiple = homeScore > awayScore ? 'leading' : homeScore < awayScore ? 'trailing' : 'tied';
    return this.generate('halftimeScore', {
      homeTeam, homeScore, awayTeam, awayScore,
      leadTeam: leading ? homeTeam : awayTeam,
      leadScore: Math.max(homeScore, awayScore),
      trailTeam: leading ? awayTeam : homeTeam,
      trailScore: Math.min(homeScore, awayScore),
      homeVerb,
      homeVerbParticiple,
    });
  }

  generateFinalScore(homeTeam, homeScore, awayTeam, awayScore) {
    const homeWins = homeScore > awayScore;
    const tied = homeScore === awayScore;
    const data = {
      homeTeam, homeScore, awayTeam, awayScore,
      winTeam: homeWins ? homeTeam : awayTeam,
      winScore: Math.max(homeScore, awayScore),
      loseTeam: homeWins ? awayTeam : homeTeam,
      loseScore: Math.min(homeScore, awayScore),
    };
    if (tied) {
      // Skip templates that imply a winner (contain {winTeam}) — avoids "Lions wins, 2 to 2"
      const pool = this.templates.finalScore.filter(t => !t.includes('{winTeam}'));
      return this.generateFromPool('finalScore', pool, data);
    }
    return this.generate('finalScore', data);
  }

  // Expand jersey numbers in custom text to player names
  expandPlayerReferences(text, homeRoster, awayRoster) {
    const allPlayers = [
      ...homeRoster.map(p => ({ ...p, roster: 'home' })),
      ...awayRoster.map(p => ({ ...p, roster: 'away' })),
    ];

    return text.replace(/#(\d+)/g, (match, num) => {
      const player = allPlayers.find(p => p.number === num);
      if (player) {
        return `number ${player.number}, ${player.firstName} ${player.lastName},`;
      }
      return match;
    });
  }
}
