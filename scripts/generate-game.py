#!/usr/bin/env python3
"""
Generate an AIAnnounceR game config JSON file.

Usage:
  python3 scripts/generate-game.py \
    --date 2026-01-15 \
    --home "Home School" \
    --home-mascot "Wildcats" \
    --home-color "#2e7d32" \
    --home-roster-file /tmp/home-roster.json \
    --opponent "Away School" \
    --mascot "Eagles" \
    --color "#b71c1c" \
    --roster-file /tmp/away-roster.json \
    --output game-2026-01-15.json

Or pipe away roster from scraper:
  python3 scripts/scrape-roster.py <url> | python3 scripts/generate-game.py \
    --date 2026-01-15 \
    --home "Home School" --home-mascot "Wildcats" --home-color "#2e7d32" \
    --home-roster-file /tmp/home-roster.json \
    --opponent "Away School" --mascot "Eagles" --color "#b71c1c" \
    --roster-stdin --output game-2026-01-15.json

Home roster JSON format (array of player objects):
  [
    {"number": "1", "firstName": "Player", "lastName": "One", "pronounce": "", "year": "Senior"},
    {"number": "2", "firstName": "Player", "lastName": "Two", "pronounce": "", "year": "Junior"}
  ]
"""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser(description='Generate AIAnnounceR game config')
    parser.add_argument('--date', required=True, help='Game date (YYYY-MM-DD)')
    parser.add_argument('--home', required=True, help='Home school name')
    parser.add_argument('--home-mascot', required=True, help='Home team mascot')
    parser.add_argument('--home-color', default='#2e7d32', help='Home team color (hex)')
    parser.add_argument('--home-roster-file', required=True, help='Path to home roster JSON file')
    parser.add_argument('--opponent', required=True, help='Opponent school name')
    parser.add_argument('--mascot', required=True, help='Opponent mascot')
    parser.add_argument('--color', default='#b71c1c', help='Opponent team color (hex)')
    parser.add_argument('--roster-file', help='Path to scraped away roster JSON file')
    parser.add_argument('--roster-stdin', action='store_true', help='Read away roster JSON from stdin')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    args = parser.parse_args()

    # Load home roster
    with open(args.home_roster_file) as f:
        home_roster = json.load(f)

    # Load visiting roster
    if args.roster_stdin:
        away_roster = json.load(sys.stdin)
    elif args.roster_file:
        with open(args.roster_file) as f:
            away_roster = json.load(f)
    else:
        print("ERROR: Provide --roster-file or --roster-stdin", file=sys.stderr)
        sys.exit(1)

    game = {
        "homeTeam": {
            "name": args.home,
            "mascot": args.home_mascot,
            "color": args.home_color,
            "energy": "high"
        },
        "awayTeam": {
            "name": args.opponent,
            "mascot": args.mascot,
            "color": args.color,
            "energy": "neutral"
        },
        "sport": "lacrosse",
        "segments": ["Q1", "Q2", "Q3", "Q4", "OT"],
        "homeRoster": home_roster,
        "awayRoster": away_roster,
        "homeScore": 0,
        "awayScore": 0,
        "period": 1,
        "events": [],
        "announcements": [
            {
                "id": "welcome",
                "title": "Welcome & Introduction",
                "text": f"Good evening and welcome to tonight's lacrosse game! The {args.home} {args.home_mascot} take on the {args.opponent} {args.mascot}. We're excited to have you here. Please stand for the national anthem.",
                "type": "static"
            },
            {
                "id": "lineup-home",
                "title": f"Starting Lineup — {args.home_mascot}",
                "text": f"Now introducing your starting lineup for the {args.home} {args.home_mascot}!",
                "type": "static"
            },
            {
                "id": "lineup-away",
                "title": f"Starting Lineup — {args.mascot}",
                "text": f"And now, the visiting {args.opponent} {args.mascot}!",
                "type": "static"
            },
            {
                "id": "halftime-score",
                "title": "Halftime Score",
                "text": "",
                "type": "dynamic"
            },
            {
                "id": "final-score",
                "title": "Final Score",
                "text": "",
                "type": "dynamic"
            },
            {
                "id": "thanks",
                "title": "Thank You & Good Night",
                "text": "That concludes tonight's game. Thank you for coming out and supporting our teams. Drive safe and have a great evening!",
                "type": "static"
            }
        ]
    }

    with open(args.output, 'w') as f:
        json.dump(game, f, indent=2)

    print(f"Created {args.output} ({len(away_roster)} visiting players)", file=sys.stderr)


if __name__ == '__main__':
    main()
