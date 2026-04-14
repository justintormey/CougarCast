# CougarCast

**The AI sports announcer that never gets nervous.**

CougarCast is an AI-powered live sports announcing system that turns any parent with a tablet into a stadium announcer. Built for high school lacrosse, but ready for any sport.

> *"Not everyone is comfortable announcing live to the whole stadium. So we built CougarCast — tap the player, tap the action, and let AI do the talking."*

---

## How It Works

```
Tap a player → Tap an action → Preview → Play to PA
```

That's it. The operator taps players and events on the dashboard, the system generates natural announcements with varied phrasing, converts them to speech via ElevenLabs, and plays the audio through the PA system.

### The Stereo Trick

CougarCast uses **stereo channel separation** for zero-hardware-overhead booth monitoring:

- **Left channel** → Booth headphones (Preview)
- **Right channel** → PA system (Play)

One device. One stereo Y-splitter cable. Done.

---

## Features

### Game Mode
- **Side-by-side rosters** — tap any player to start building an announcement
- **Sequence builder** — tap player + action and the system composes the announcement. Order doesn't matter: `Player → GOAL` or `GOAL → Player` both work
- **Varied phrasing** — never hear the same announcement twice in a row. Template pools with smart repeat avoidance keep it fresh
- **Manual score tracking** — +/- buttons for each team, auto-increments on goals
- **Custom announcements** — tap CUSTOM, type anything, tap players to insert names at cursor

### Announcements
- **Ordered list** — drag to reorder with up/down arrows, swipe left to delete
- **Pre-render** — generate audio ahead of time so it plays instantly
- **Preview before broadcast** — listen on the left/booth channel before sending to PA
- **Dynamic score announcements** — check "Include current score" and the text auto-generates from the live score every time

### Smart Pronunciation
Every player has a **"Say as..."** field. If ElevenLabs butchers a name, type the phonetic spelling:

| Name | Say as... |
|------|-----------|
| Nguyen | Win |
| Patel | Puh-tell |
| Garcia | Gar-see-ah |
| Xiong | Shong |

The UI always shows the real name. Only the TTS gets the phonetic version.

### Energy Levels
Set per team in Settings:

- **High energy** (home team) — *"GOAL! What a shot! Emily Barton scores for the Wildcats!"*
- **Neutral** (visiting team) — *"Goal by Emily Barton for the Eagles."*

This affects both the announcement phrasing AND the ElevenLabs voice parameters (stability, style expressiveness).

### Multi-Sport Support
Select your sport in Settings and the app auto-configures:

| Sport | Segments | Actions |
|-------|----------|---------|
| **Lacrosse** | Q1–Q4, OT | Goal, Assist, Yellow Card, Red Card, Timeout |
| **Field Hockey** | Q1–Q4, OT | Goal, Assist, Green/Yellow/Red Card, Timeout |
| **Ice Hockey** | P1–P3, OT | Goal, Assist, Penalty, Timeout |
| **Soccer** | 1st/2nd Half, OT | Goal, Assist, Yellow/Red Card |
| **Basketball** | Q1–Q4, OT | Basket, Assist, Foul, Technical, Timeout |
| **Football** | Q1–Q4, OT | Score, Flag, Timeout |
| **Baseball** | 1st–9th | Run |
| **Custom** | You define | You define |

---

## Setup

### What You Need

1. A **tablet or phone** (the operator's device)
2. An **ElevenLabs account** ([elevenlabs.io](https://elevenlabs.io) — free tier works for demos)
3. A **stereo Y-splitter cable** (~$5) and headphones for booth preview
4. The **PA system's aux/line input**

### Quick Start

1. Clone this repo and open `index.html` in a browser (or serve with any static server)
2. Tap the **gear icon** → enter your ElevenLabs API key → refresh voices → pick a voice
3. Set up your **teams** (name, mascot, color) and **rosters** (number, name, position)
4. Fill in the **"Say as..."** field for any tricky names
5. Switch to the **Announcements** tab → add your pre-game, sponsor, and post-game announcements
6. **Connect** the tablet to the PA via the stereo Y-splitter
7. You're live!

### ElevenLabs Setup

1. Create an account at [elevenlabs.io](https://elevenlabs.io)
2. Go to **Profile** → copy your **API Key**
3. In CougarCast Settings, paste the key and click the refresh button next to Voice
4. Select a voice — recommended voices for sports announcing:
   - **Daniel** — Steady Broadcaster (great default)
   - **Adam** — Dominant, Firm
   - **Bill** — Wise, Mature, Balanced

### Audio Setup

```
┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│   Tablet    │────▶│ Stereo Y-Splitter │────▶│ PA Input │
│(CougarCast)│     │                  │     │ (Right)  │
└─────────────┘     │                  │     └──────────┘
                    │                  │     ┌──────────┐
                    │                  │────▶│Headphones│
                    └──────────────────┘     │ (Left)   │
                                             └──────────┘
```

- **PREVIEW** button → plays on LEFT channel (your headphones in the booth)
- **PLAY** button → plays on RIGHT channel (the PA system / broadcast)

---

## Game Day Workflow

### Before the Game

1. **Set up rosters** — enter both teams with player numbers, names, and positions
2. **Check pronunciations** — fill in "Say as..." for any names the TTS struggles with
3. **Prepare announcements** — add welcome, lineup, sponsor reads, halftime, closing
4. **Pre-render** — tap RENDER on each announcement to generate audio ahead of time
5. **Preview everything** — listen through each one to catch any issues

### During the Game

1. **Stay on the Game tab** — rosters and action buttons are all right there
2. **Goal scored?** → Tap the scorer → tap GOAL → (optionally tap assister → ASSIST) → Preview → Play
3. **Timeout?** → Tap TIMEOUT → tap any player on the team calling it → Play
4. **Penalty?** → Tap the player → tap YELLOW CARD / RED CARD → Play
5. **Custom moment?** → Tap CUSTOM → type it → tap player names to insert them → Play
6. **Switch to Announcements tab** for sponsor reads, halftime score, etc.

### Score Management

- Score **auto-increments** when you play a GOAL announcement
- Use the **+/- buttons** to manually adjust (goal reversed, correction, etc.)
- **Dynamic announcements** automatically include the current score

---

## Configuration

### Settings Panel

| Setting | Description |
|---------|-------------|
| **ElevenLabs API Key** | Your API key from elevenlabs.io/profile — stored in browser localStorage, never sent to a server |
| **Voice** | Select from available ElevenLabs voices |
| **Sport** | Pre-configures game segments and action buttons |
| **Game Segments** | Comma-separated (e.g., `Q1, Q2, Q3, Q4, OT`) |
| **Home/Away Team** | Name, mascot, team color |
| **Energy** | High (home) or Neutral (away) — affects phrasing and voice delivery |
| **Rosters** | Number, first name, last name, position, pronunciation override |
| **Import/Export** | Save/load game data as JSON for reuse |

### Data Persistence

All data is stored in your browser's **localStorage**:

- Team names, colors, rosters
- Announcements and their order
- ElevenLabs API key and voice selection
- Score (resets on new game setup)

Use **Export Game Data** to save a JSON backup. **Import** to restore or share setups between devices.

### Roster Format

See `data/sample-game.json` for the expected JSON structure.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML/CSS/JS (ES Modules) |
| TTS | ElevenLabs API (pluggable provider interface) |
| Text Generation | Template pools with randomized phrasing |
| Audio Routing | Web Audio API (StereoPannerNode) |
| Storage | localStorage + JSON import/export |

---

## Roadmap

- [ ] Native iOS app — better offline support, native audio routing
- [ ] Claude API integration — context-aware commentary instead of templates
- [ ] Music cues — short clips for hype moments, goal horns
- [ ] Playlist integration — Spotify/Apple Music for pre-game and halftime
- [ ] Two-device mode — controller tablet + dedicated PA player
- [ ] Voice cloning — clone the retiring announcer's voice (with permission!)
- [ ] Live stats feed — auto-update from scoring systems

---

## License

MIT License. See [LICENSE](LICENSE) for details.
