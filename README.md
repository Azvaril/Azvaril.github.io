# Azvaril's Puzzles

A static site listing my Sudoku variant puzzles, hosted on GitHub Pages.

## Running it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser. 

## How the site is built

- **`AllPuzzles.csv`** — one row per puzzle: `Name`, `Link` (SudokuPad URL), `Tags`, `Difficulty`, `ID`, `Image`, `Notes`.
- **`Rules.csv`** — one row per rule/variant: `Rule` name and its `Description`. The puzzle description shown on each card is generated automatically from the puzzle's `Tags`, by looking up each tag in `Rules.csv`.
- **`images/`** — one preview image per puzzle.
- **`script.js`** fetches both CSVs, parses them, joins tags to rules, and renders the filterable/sortable puzzle list.

## Adding a new puzzle

1. Add the puzzle's preview image to `images/` (any descriptive filename, e.g. `My_New_Puzzle.png`).
2. Add a row to `AllPuzzles.csv`:

   | Column | What goes there |
   |---|---|
   | `Name` | Puzzle title, shown as the card heading |
   | `Link` | The SudokuPad (or other solving site) URL |
   | `Tags` | Comma-separated list, **always starting with `Normal`**, then one tag per variant used (e.g. `Normal, Kropki, Thermometer`). Each tag (other than `Normal`) must exactly match a `Rule` name in `Rules.csv` — that's how the description and the tag filters are generated |
   | `Difficulty` | A number from 1–9 (shown as `X/10` plus a difficulty bar) |
   | `ID` | The next unused integer. IDs are chronological — the highest ID is treated as the newest puzzle for the default sort order |
   | `Image` | The exact filename added to `images/` |
   | `Notes` | Optional. Only needed for a one-off clarification that doesn't belong in `Rules.csv` (e.g. the two Fixed Thermometer puzzles' extra sentence about the step size). Leave blank otherwise |

3. If the puzzle uses a variant that isn't in `Rules.csv` yet, add a row there first: `Rule` (must match the tag name exactly) and `Description` (the rule text, written the way you want it to read on every puzzle that uses it).

