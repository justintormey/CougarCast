#!/usr/bin/env python3
"""
Scrape a girls lacrosse roster from highschoolsports.example.com
and output JSON matching the Mike 2.0 game file format.

Usage:
  python3 scripts/scrape-roster.py <roster_url>
  python3 scripts/scrape-roster.py https://highschoolsports.example.com/school/your-school/girlslacrosse/season/YYYY-YYYY/roster

Uses only Python stdlib (no pip install needed).
"""

import json
import sys
import urllib.request
from html.parser import HTMLParser


class RosterParser(HTMLParser):
    """Parse the roster table from the HTML page."""

    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_thead = False
        self.in_tbody = False
        self.in_row = False
        self.in_cell = False
        self.current_row = []
        self.current_cell = ''
        self.headers = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'table':
            self.in_table = True
        elif tag == 'thead' and self.in_table:
            self.in_thead = True
        elif tag == 'tbody' and self.in_table:
            self.in_tbody = True
        elif tag == 'tr' and self.in_table:
            self.in_row = True
            self.current_row = []
        elif tag in ('td', 'th') and self.in_row:
            self.in_cell = True
            self.current_cell = ''

    def handle_endtag(self, tag):
        if tag == 'table':
            self.in_table = False
        elif tag == 'thead':
            self.in_thead = False
        elif tag == 'tbody':
            self.in_tbody = False
        elif tag == 'tr' and self.in_row:
            self.in_row = False
            if self.in_thead:
                self.headers = [c.strip() for c in self.current_row]
            elif self.in_tbody or self.in_table:
                self.rows.append([c.strip() for c in self.current_row])
        elif tag in ('td', 'th') and self.in_cell:
            self.in_cell = False
            self.current_row.append(self.current_cell)

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell += data


def fetch_page(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8', errors='replace')


def parse_roster(html):
    parser = RosterParser()
    parser.feed(html)

    if not parser.headers or not parser.rows:
        return []

    # Find column indices
    h = [c.lower().strip() for c in parser.headers]
    num_idx = next((i for i, c in enumerate(h) if c in ('#', 'no', 'no.', 'number')), None)
    name_idx = next((i for i, c in enumerate(h) if c in ('name', 'player')), None)
    class_idx = next((i for i, c in enumerate(h) if c in ('class', 'year', 'yr', 'gr')), None)

    if num_idx is None or name_idx is None:
        print(f"WARNING: Could not find columns. Headers: {parser.headers}", file=sys.stderr)
        return []

    players = []
    for row in parser.rows:
        if len(row) <= max(num_idx, name_idx):
            continue

        number = row[num_idx].strip()
        full_name = row[name_idx].strip()
        year = row[class_idx].strip() if class_idx is not None and class_idx < len(row) else ''

        if not full_name or not number:
            continue

        # Split name into first/last
        parts = full_name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = ' '.join(parts[1:])
        else:
            first_name = full_name
            last_name = ''

        # Normalize year
        year_map = {
            'fr': 'Freshman', 'freshman': 'Freshman', '9': 'Freshman',
            'so': 'Sophomore', 'sophomore': 'Sophomore', '10': 'Sophomore',
            'jr': 'Junior', 'junior': 'Junior', '11': 'Junior',
            'sr': 'Senior', 'senior': 'Senior', '12': 'Senior',
        }
        year = year_map.get(year.lower(), year.title() if year else '')

        players.append({
            'number': number,
            'firstName': first_name,
            'lastName': last_name,
            'pronounce': '',
            'year': year,
        })

    return players


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scrape-roster.py <roster_url>")
        print("Example: python3 scrape-roster.py https://highschoolsports.example.com/school/your-school/girlslacrosse/season/YYYY-YYYY/roster")
        sys.exit(1)

    url = sys.argv[1]
    print(f"Fetching {url}...", file=sys.stderr)

    html = fetch_page(url)
    players = parse_roster(html)

    if not players:
        print("ERROR: No players found. The page structure may have changed.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(players)} players", file=sys.stderr)
    print(json.dumps(players, indent=2))


if __name__ == '__main__':
    main()
