# 📚 Word Coach Ultra

**TalkBack-first vocabulary game suite** — English with Telugu glosses. Pure HTML/CSS/JS (no build), fully offline, installable PWA.

## 🎮 Games
| Game | How it plays | Rewards |
|---|---|---|
| 🃏 **Flashcards** | Hear the word, flip for meaning + తెలుగు + example, mark Know/Again (unknown words loop back) | +2 🪙 per word learned |
| ❓ **Meaning Quiz** | 10 questions, 4 options, voiced feedback | +10 🪙 per correct, streak +5, bonuses at 8/10 (+25) and 10/10 (+50) |
| 🐝 **Spelling Bee** | The app speaks the word — type it; wrong answers are spelled out letter-by-letter (blind-friendly) | coins = word length |
| ⛓️ **Word Chain vs AI** | Your word must start with the AI word's last letter; bank-validated; AI plays back until someone is stuck | up to +50 🪙 for a win |
| 🌅 **Word of the Day** | Fresh word daily with hear-it button | — |

## ✨ Accessibility (built for TalkBack users)
- aria-live announcements for every result, score, and instruction
- Text-to-speech everywhere: words, meanings, examples, feedback, letter-by-letter spelling
- Real buttons everywhere (no fake divs), focus outlines, skip link, keyboard play (Enter submits)
- Light/dark theme, large-text mode, adjustable speech speed
- 🪙 coins, ⭐ levels, 🔥 streaks, 🎁 daily bonus — all announced aloud; progress saved offline

## 🚀 Run / deploy
Any static host — no build step:
```bash
python3 -m http.server    # then open http://localhost:8000
```
GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.
Vercel/Netlify: import this repo, framework = "Other", output = root.

## 📦 Word bank
120 curated words across 3 levels (everyday → exam → advanced/competitive, e.g. *democracy, subsidy, sovereignty*), each with meaning, Telugu gloss, example sentence. Edit `words.js` to add more.

## v2.0.0 — Learning + Auto-Update
- 🔁 **Review Deck** — every word you miss in any game is saved automatically and
  keeps coming back until you master it.
- 📊 **Progress panel** — games played, words mastered, Review Deck size, answer
  accuracy, best streak.
- 🧠 **420-word academic bank** — Level 3 adds economics, civics, commerce,
  accountancy, science, English literature and Telugu-studies vocabulary (the
  broken 600-entry merge that crashed words.js was removed and replaced).
- 🔄 **Automatic updates** — the service worker now checks for new versions and
  shows a "New version ready" button; no more being stuck on an old build.
- ♿ **Accessible auth dialogs** — focus trap, Escape to close, inline error
  messages instead of alert(), no auto-submit while typing the OTP.
