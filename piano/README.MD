# 🎹 MIDI Survivor

**Play piano to defend your castle from musical monsters!**

A browser-based arcade game where enemies approach your castle, and you destroy them by playing the matching musical note on your piano (MIDI keyboard or computer keyboard).

🎮 **[Play the game](https://funwithcomputervision.com/piano/)**

![MIDI Survivor Screenshot](https://funwithcomputervision.com/assets/midi-survivor.png)

---

## How to Play

### Goal
Protect your castle from waves of enemies by playing the correct notes on your keyboard.

### Basic Controls

**Using a MIDI Keyboard:**
1. Connect your MIDI keyboard to your computer
2. The game will automatically detect it (you'll see "MIDI CONNECTED" in the top right)
3. Play the note shown above each enemy to destroy them

**Using Your Computer Keyboard:**
- White keys: `A S D F G H J K` (plays C D E F G A B C)
- Black keys: `W E T Y U` (plays C# D# F# G# A#)

### Gameplay

1. **Enemies spawn** from the edges of the screen and move toward your castle in the center
2. Each enemy has a **note label** above it (like "C", "D#", "Bb")
3. **Play the matching note** to destroy the enemy with a lightning bolt
4. **Build combos** by hitting consecutive correct notes for bonus points
5. If you play the **wrong note**, your combo resets
6. If an enemy **reaches your castle**, you lose health
7. **Survive as many waves as possible!**

### Enemy Types

| Type | Appearance | How to Beat |
|------|------------|-------------|
| Normal | Standard enemy | Play the note once |
| Fast | Moves quicker (appears after Wave 3) | Play the note once, but be fast! |
| Hold | Shows "HOLD" label with a trail | Press and **hold** the note until the progress ring fills up |

### Scales

Each wave uses a different musical scale. Only notes from that scale will appear. The current scale is shown at the top center of the screen. Examples:
- C Major, A Minor, G Major
- Pentatonic scales
- Minor and major keys with flats/sharps

## How to Run Locally

This is a single HTML file with no dependencies. Just:

1. Download `index.html`
2. Open it in any modern browser (Chrome, Firefox, Safari, Edge)
3. That's it!

Or serve it with any local server:
```bash
# Python 3
python -m http.server 8000

# Node.js (if you have npx)
npx serve .
```

Then open `http://localhost:8000` in your browser.

---

## Tech Stack

This game is built entirely in one HTML file using vanilla web technologies:

### Languages
- **HTML** - Page structure
- **CSS** - Styling and animations
- **JavaScript** - Game logic (no frameworks)

### Web APIs Used

| API | What it does in this game |
|-----|---------------------------|
| **Canvas API** | Draws all the graphics (enemies, castle, particles, lightning) |
| **Web MIDI API** | Connects to your MIDI keyboard to receive note events |
| **Web Audio API** | Creates the sound effects (hits, misses, beat pulses) |
| **Local Storage** | Saves your high score between sessions |
| **requestAnimationFrame** | Runs the game loop smoothly at 60fps |

### Graphics

All visuals are drawn programmatically using the Canvas API:
- **Pixel art sprites** are stored as 2D arrays of 1s and 0s
- **Particles** create explosion effects when enemies die
- **Lightning bolts** are generated with random zigzag paths
- **Glow effects** use CSS shadows and canvas gradients

### No External Dependencies

The game doesn't use:
- No game engines (Phaser, PixiJS, etc.)
- No JavaScript frameworks (React, Vue, etc.)
- No build tools (Webpack, Vite, etc.)
- No external JavaScript libraries

Just pure HTML, CSS, and JavaScript running in your browser.