# Pindle

A simple Wordle-inspired daily PIN game where you guess a 4-digit code in 6 tries.

Inspired by the "guess my PIN" social trend, Pindle gives feedback per digit:

- `Green`: correct digit in the correct position
- `Yellow`: digit exists in the PIN but in a different position
- `Gray`: digit is not available (or already fully used by other matches)

Duplicate digits are handled correctly using a two-pass match algorithm.

## Features

- Daily PIN generation based on current date (same puzzle for everyone that day)
- 6 guesses per game
- Physical keyboard + on-screen keypad input
- Duplicate-aware scoring logic
- One-time hint button (reveals one correct digit)
- Live "combinations left" counter based on submitted guesses
- Share result button with emoji grid copy to clipboard
- Hint usage included in share output
- Light / dark / system theme toggle with saved preference
- LocalStorage game persistence so reloads do not reset today’s game

## Configuration

Core game config lives in `script.js` under `GAME_CONFIG`.

- `maxRows`: number of guesses allowed
- `pinLength`: number of digits in the PIN

Notes:

- The keypad/grid in `index.html` is currently set up for 4 digits.
- If you change `pinLength`, update board markup and keypad UX accordingly.

## Local Development

This is a plain HTML/CSS/JS project.

1. Clone/download the repo.
2. Install minification tooling: `npm install`
3. Run `npm run minify` to generate .css and .js
3. Open `index.html` in your browser.
4. Edit files directly in your editor.
5. Once your edits are complete, run `npm run format && npm run minify` again to generate the minified files.

If your browser restricts clipboard APIs on `file://`, run a local server for best behavior.

## Project Structure

- `index.html` - game markup and controls
- `style.css` - game styling, responsive layout, and theming
- `script.js` - game state, scoring, storage, sharing, and theme logic
- `reset.css` - baseline/reset styles

## Daily PIN Algorithm

Pindle generates one deterministic PIN per date.

1. Build a date seed as `YYYYMMDD`.
2. Run a lightweight linear congruential generator each digit:
   - `seed = (seed * 1664525 + 1013904223) % 4294967296`
3. Append `seed % 10` as the next PIN digit.
4. Repeat for `pinLength` digits.

Because the algorithm is deterministic, everyone gets the same PIN on the same day, and a new PIN when the date changes.

## Persistence Model

- Game state is saved per day in LocalStorage.
- Reloading restores progress for the current date.
- When the date changes, a new daily puzzle key is used automatically.

## Sharing

When you win, the message area is replaced by a share button.
Share output includes:

- Puzzle date and score (for example `3/6`)
- Whether a hint was used
- Emoji grid (`🟩`, `🟨`, `⬛`)
- Current page URL

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

Setup steps (one-time):

1. Push this project to a GitHub repo.
2. In GitHub, open `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` (or run the workflow manually from `Actions`).

Your site will publish to:

- `https://<your-username>.github.io/<repo-name>/`

Notes:

- `.nojekyll` is included so static files are served as-is.
- If your default branch is not `main`, update the branch in `.github/workflows/deploy-pages.yml`.
