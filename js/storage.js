// Storage module — localStorage persistence + import/export

const KEYS = {
  GAME: 'ainnouncr_game',
  API_KEY: 'ainnouncr_elevenlabs_key',
  VOICE_ID: 'ainnouncr_voice_id',
};

const SAMPLE_GAME = {
  homeTeam: { name: "Home Team", mascot: "Wildcats", color: "#2e7d32", energy: "high" },
  awayTeam: { name: "Visiting Team", mascot: "Eagles", color: "#b71c1c", energy: "neutral" },
  sport: "lacrosse",
  segments: ["Q1", "Q2", "Q3", "Q4", "OT"],
  homeRoster: [
    { number: "1", firstName: "Player", lastName: "One", pronounce: "", year: "Senior" },
    { number: "2", firstName: "Player", lastName: "Two", pronounce: "", year: "Junior" },
    { number: "3", firstName: "Player", lastName: "Three", pronounce: "", year: "Sophomore" },
    { number: "4", firstName: "Player", lastName: "Four", pronounce: "", year: "Freshman" },
    { number: "5", firstName: "Player", lastName: "Five", pronounce: "", year: "Senior" },
    { number: "6", firstName: "Player", lastName: "Six", pronounce: "", year: "Junior" },
    { number: "7", firstName: "Player", lastName: "Seven", pronounce: "", year: "Sophomore" },
    { number: "8", firstName: "Player", lastName: "Eight", pronounce: "", year: "Freshman" },
    { number: "9", firstName: "Player", lastName: "Nine", pronounce: "", year: "Senior" },
    { number: "10", firstName: "Player", lastName: "Ten", pronounce: "", year: "Junior" },
  ],
  awayRoster: [
    { number: "1", firstName: "Player", lastName: "One", pronounce: "", year: "Senior" },
    { number: "2", firstName: "Player", lastName: "Two", pronounce: "", year: "Junior" },
    { number: "3", firstName: "Player", lastName: "Three", pronounce: "", year: "Sophomore" },
    { number: "4", firstName: "Player", lastName: "Four", pronounce: "", year: "Freshman" },
    { number: "5", firstName: "Player", lastName: "Five", pronounce: "", year: "Senior" },
    { number: "6", firstName: "Player", lastName: "Six", pronounce: "", year: "Junior" },
    { number: "7", firstName: "Player", lastName: "Seven", pronounce: "", year: "Sophomore" },
    { number: "8", firstName: "Player", lastName: "Eight", pronounce: "", year: "Freshman" },
    { number: "9", firstName: "Player", lastName: "Nine", pronounce: "", year: "Senior" },
    { number: "10", firstName: "Player", lastName: "Ten", pronounce: "", year: "Junior" },
  ],
  homeScore: 0,
  awayScore: 0,
  period: 1,
  events: [],
  announcements: [
    { id: "welcome", title: "Welcome & Introduction", phase: "pre-game", text: "Good evening and welcome to tonight's lacrosse game! We're excited to have you here. Please stand for the national anthem.", type: "static" },
    { id: "lineup-home", title: "Starting Lineup — Home", phase: "pre-game", text: "Now introducing your starting lineup for the home team!", type: "static" },
    { id: "lineup-away", title: "Starting Lineup — Visiting", phase: "pre-game", text: "And now, the visiting team!", type: "static" },
    { id: "halftime-score", title: "Halftime Score", phase: "halftime", text: "", type: "dynamic" },
    { id: "sponsor-1", title: "Sponsor: Bob's Auto Body", phase: "halftime", text: "Tonight's game is brought to you by Bob's Auto Body. For all your collision repair needs, visit Bob's Auto Body on Main Street. Bob's — we'll get you back on the road!", type: "static" },
    { id: "final-score", title: "Final Score", phase: "post-game", text: "", type: "dynamic" },
    { id: "thanks", title: "Thank You & Good Night", phase: "post-game", text: "That concludes tonight's game. Thank you for coming out and supporting our teams. Drive safe and have a great evening!", type: "static" },
  ],
};

export class Storage {
  loadGame() {
    const saved = localStorage.getItem(KEYS.GAME);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Corrupted data, fall through to sample
      }
    }
    // First run — load sample data
    const game = structuredClone(SAMPLE_GAME);
    this.saveGame(game);
    return game;
  }

  saveGame(gameState) {
    localStorage.setItem(KEYS.GAME, JSON.stringify(gameState));
  }

  getApiKey() {
    return localStorage.getItem(KEYS.API_KEY) || '';
  }

  setApiKey(key) {
    if (key) {
      localStorage.setItem(KEYS.API_KEY, key);
    } else {
      localStorage.removeItem(KEYS.API_KEY);
    }
  }

  getVoiceId() {
    return localStorage.getItem(KEYS.VOICE_ID) || '';
  }

  setVoiceId(id) {
    if (id) {
      localStorage.setItem(KEYS.VOICE_ID, id);
    } else {
      localStorage.removeItem(KEYS.VOICE_ID);
    }
  }

  clear() {
    localStorage.removeItem(KEYS.GAME);
  }
}
