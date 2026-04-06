#!/usr/bin/env python3
"""
Generate a Mike 2.0 game config JSON file.

Usage:
  python3 scripts/generate-game.py \
    --date 2026-03-31 \
    --opponent "Ridge" \
    --mascot "Red Devils" \
    --color "#c62828" \
    --roster-file /tmp/ridge-roster.json \
    --output cougars-vs-ridge-2026-03-31.json

Or pipe roster from scraper:
  python3 scripts/scrape-roster.py <url> | python3 scripts/generate-game.py \
    --date 2026-03-31 --opponent "Ridge" --mascot "Red Devils" --color "#c62828" \
    --roster-stdin --output cougars-vs-ridge-2026-03-31.json
"""

import argparse
import json
import sys

# Home Team home roster (constant)
HOME_ROSTER = [
    {"number": "1", "firstName": "Elliana", "lastName": "Pizzulli", "pronounce": "", "year": "Senior"},
    {"number": "2", "firstName": "Mollie", "lastName": "Little", "pronounce": "", "year": "Sophomore"},
    {"number": "4", "firstName": "Delsa", "lastName": "Malmasi", "pronounce": "", "year": "Freshman"},
    {"number": "5", "firstName": "Carson", "lastName": "Benedict", "pronounce": "", "year": "Freshman"},
    {"number": "6", "firstName": "Emma", "lastName": "Scrudato", "pronounce": "", "year": "Senior"},
    {"number": "7", "firstName": "Ella", "lastName": "DeBruin", "pronounce": "", "year": "Senior"},
    {"number": "7", "firstName": "Lina", "lastName": "Papadakis", "pronounce": "", "year": "Senior"},
    {"number": "8", "firstName": "Rachel", "lastName": "Haggan", "pronounce": "", "year": "Junior"},
    {"number": "9", "firstName": "Hadley", "lastName": "DeBruin", "pronounce": "", "year": "Sophomore"},
    {"number": "11", "firstName": "Kennedy", "lastName": "Dexter", "pronounce": "", "year": "Sophomore"},
    {"number": "12", "firstName": "Claire", "lastName": "Haggan", "pronounce": "", "year": "Sophomore"},
    {"number": "13", "firstName": "Mia", "lastName": "Dexter", "pronounce": "", "year": "Senior"},
    {"number": "14", "firstName": "Sophia", "lastName": "Soron", "pronounce": "", "year": "Junior"},
    {"number": "15", "firstName": "Lexi", "lastName": "Lopez", "pronounce": "", "year": "Senior"},
    {"number": "16", "firstName": "Katelyn", "lastName": "Manley", "pronounce": "", "year": "Freshman"},
    {"number": "19", "firstName": "Kristin", "lastName": "Huang", "pronounce": "", "year": "Freshman"},
    {"number": "20", "firstName": "Victoria", "lastName": "Formica", "pronounce": "", "year": "Senior"},
    {"number": "21", "firstName": "Lexi", "lastName": "Sambol", "pronounce": "", "year": "Senior"},
    {"number": "22", "firstName": "Anya", "lastName": "Obe", "pronounce": "", "year": "Junior"},
    {"number": "25", "firstName": "Anna", "lastName": "Petrozzini", "pronounce": "", "year": "Junior"},
    {"number": "66", "firstName": "Elizabeth", "lastName": "Andes", "pronounce": "", "year": "Freshman"},
]


def main():
    parser = argparse.ArgumentParser(description='Generate Mike 2.0 game config')
    parser.add_argument('--date', required=True, help='Game date (YYYY-MM-DD)')
    parser.add_argument('--opponent', required=True, help='Opponent school name')
    parser.add_argument('--mascot', required=True, help='Opponent mascot')
    parser.add_argument('--color', default='#b71c1c', help='Opponent team color (hex)')
    parser.add_argument('--roster-file', help='Path to scraped roster JSON file')
    parser.add_argument('--roster-stdin', action='store_true', help='Read roster JSON from stdin')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    args = parser.parse_args()

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
            "name": "Home School",
            "mascot": "Cougars",
            "color": "#2e7d32",
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
        "homeRoster": HOME_ROSTER,
        "awayRoster": away_roster,
        "homeScore": 0,
        "awayScore": 0,
        "period": 1,
        "events": [],
        "announcements": [
            {
                "id": "welcome",
                "title": "Welcome & Introduction",
                "text": f"Good evening and welcome to tonight's lacrosse game! The Home Team take on the {args.opponent} {args.mascot}. We're excited to have you here. Please stand for the national anthem.",
                "type": "static"
            },
            {
                "id": "lineup-home",
                "title": "Starting Lineup — Cougars",
                "text": "Now introducing your starting lineup for the Home Team!",
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
