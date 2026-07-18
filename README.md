# Highway Racer Ultimate

Premium endless highway racing browser game — glassmorphism UI, cinematic race intro, garage, missions, and full LocalStorage progression.

**Designed by Narendra Thodeti**

Live repository: [github.com/tnaren612/highway-racer-ultimate](https://github.com/tnaren612/highway-racer-ultimate)

GitHub Pages (when enabled): [tnaren612.github.io/highway-racer-ultimate](https://tnaren612.github.io/highway-racer-ultimate/)

---

## Features

| Feature | Description |
|--------|-------------|
| **Driver registration** | First launch asks for a driver name (2–20 chars). Saved to LocalStorage and skipped on later launches. |
| **Vehicle garage** | Choose Sedan, SUV, Sports, Truck, or Electric with rotating 3D preview. |
| **Paint selection** | Ten premium colors; live preview; selection is saved per profile. |
| **Cinematic intro** | Camera push, garage drive-out, center-lane align, engine ignition. |
| **Countdown** | 3 · 2 · 1 · GO! Controls unlock only after GO. |
| **Infinite highway** | Three-lane perspective road with markings and roadside scenery. |
| **Traffic AI** | Random vehicles, difficulty ramp, near-miss bonuses. |
| **Police chase** | Occasional pursuits; escape for mission credit and score. |
| **Weather & day cycle** | Sunrise, day, sunset, night; clear, rain, fog; wet-road look. |
| **Fuel & nitro** | Fuel drains while driving; nitro boost with meter and SFX. |
| **Coins & XP** | Collect coins on the road; earn XP and levels from runs. |
| **Missions** | In-run objectives with progress bar and rewards. |
| **Combo system** | Near misses and events build a score multiplier. |
| **Garage upgrades** | Engine, handling, nitro, armor (coin costs, max level 5). |
| **Achievements** | Unlock trophies for distance, speed, coins, combos, and more. |
| **Daily rewards** | Claim increasing coin rewards on a streak. |
| **Leaderboard** | Local top scores stored in the browser. |
| **Statistics & profile** | Career totals, best score, distance, owned cars. |
| **Settings** | Music, sound, graphics quality, FPS, fullscreen, sensitivity, rename, reset. |
| **Controls** | Keyboard, touch pad, and gamepad. |
| **Autosave** | Progress written to LocalStorage continuously. |
| **Watermark** | Corner credit: Designed by Narendra Thodeti (all screens). |

---

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| **W** / **↑** | Accelerate |
| **S** / **↓** | Brake |
| **A** / **←** | Steer left |
| **D** / **→** | Steer right |
| **Space** | Nitro |
| **P** | Pause |
| **Esc** | Pause menu |

### Touch

- Virtual stick (steer + throttle/brake lean)
- **N₂O** button
- **BRAKE** button

### Gamepad

- Left stick: steer / throttle
- Face buttons: accelerate, brake, nitro
- Start/Options: pause (where supported)

---

## Game Flow

1. Open the game (local server or GitHub Pages).
2. Wait for load, then click **ENTER GAME**.
3. **First time only:** enter **Driver Name** → **CONTINUE TO CARS**.
4. **Select vehicle** with ‹ › or class chips.
5. **Select paint color** (preview updates immediately).
6. Click **START RACE**.
7. Watch the cinematic intro and countdown **3 · 2 · 1 · GO!**.
8. Drive — keyboard / touch / gamepad enabled after **GO!**.

Returning players: name is loaded automatically; ENTER GAME goes to vehicle selection.

---

## Gameplay

### Coins

- Pick up glowing coins on the highway.
- Spend coins on vehicles and garage upgrades.
- Run-end bonuses add to your bank.
- Displayed on HUD during races and in menus.

### Fuel

- Fuel drains while moving (nitro drains faster).
- Empty fuel slows you to a stop and can end the run.
- Electric vehicles use a more efficient drain rate.

### Nitro

- Hold **Space** (or touch N₂O) when the meter has charge.
- Boosts top speed and acceleration briefly.
- Meter regenerates slowly when not in use.

### XP & levels

- Earn XP from distance, near misses, and completed missions.
- Leveling up awards bonus coins.
- Profile shows XP bar and title progression.

### Distance & score

- Distance is endless-run progress (km).
- Score combines speed, coins, combos, missions, and distance.
- Best score is stored and shown on the local leaderboard.

### Police

- At higher difficulty, police may chase you.
- Stay fast and clear to escape; getting caught ends the run.

### Weather

- Dynamic phases: sunrise → day → sunset → night.
- Weather: clear, rain, fog.
- Rain lowers grip slightly and adds wet-road visuals/particles.

### Garage

- Full garage screen (menu) for upgrades, paint, wheels, purchase.
- Pre-race garage for quick select + paint + START RACE.
- Always restores last selected vehicle, paint, and upgrades.

### Achievements

- Goals such as first km, speed thresholds, coin totals, combos, full garage.
- Unlocking grants coins and XP.

### Daily rewards

- Claim once per day; streak increases reward value.
- Missed days reset the streak.

### Leaderboard

- Local-only top runs (name, score, distance, date).
- No online backend.

### Vehicle upgrades

- **Engine**, **Handling**, **Nitro**, **Armor** (0–5).
- Costs scale with level; apply to the selected car permanently (LocalStorage).

### Missions

- Random run objectives (distance, coins, near misses, speed, nitro uses, police escape).
- Progress bar on HUD; completion pays coins/XP and rolls a new mission.

### Unlockables

- Starter car free (Sedan).
- SUV, Sports, Truck, Electric purchasable with coins.
- Locked cars show price and UNLOCK until owned.

### High scores

- Best score and best distance on profile/statistics.
- Leaderboard keeps top 10 local entries.

### Saving progress (LocalStorage)

Key: `hru_save_v1`

Stores:

- Driver name & registration flag  
- Coins, XP, level  
- Selected vehicle & paint  
- Unlocked cars & per-car upgrades/paint/wheels  
- Settings  
- Achievements & statistics  
- Daily reward streak  
- Leaderboard  

Data stays in **your browser** only. Clearing site data wipes progress.

### Reset progress

**Settings → Reset Progress** — confirms, wipes save, and returns you to driver registration.

### Settings

| Option | Effect |
|--------|--------|
| Change Driver Name | Rename without losing progress |
| Master / Music / Sound | Volume sliders |
| Mute All | Silence output |
| High Quality | Pixel ratio / shadows preference |
| Show FPS | FPS counter on HUD |
| Fullscreen | Browser fullscreen API |
| Steering sensitivity | Steer response |
| Reset Progress | Wipe LocalStorage save |

---

## Project structure

```
HighwayRacerUltimate/
├── index.html              # App shell, all screens & HUD markup
├── style.css               # Glass UI, layout, animations, watermark
├── main.js                 # Boot, menus, onboarding, garage wiring
├── README.md               # This file
├── CHANGELOG.md            # Version history
├── RELEASE_NOTES.md        # Latest release summary
├── LICENSE                 # MIT License
├── .gitignore
├── .nojekyll               # GitHub Pages: serve files as-is
├── start-server.bat        # Local Python HTTP server helper
├── install-python.bat      # Python install helper (Windows)
├── open-game.bat           # Open index.html without server
├── deploy-github.bat       # Push / Pages helper for tnaren612
├── verify.mjs              # Static project checks (Node)
├── assets/
│   ├── images/             # Optional image assets
│   ├── sounds/             # Optional audio files (procedural audio used by default)
│   ├── fonts/              # Optional local fonts
│   └── models/             # Optional 3D models (procedural meshes by default)
└── js/
    ├── storage.js          # LocalStorage save/load, coins, XP, achievements
    ├── audio.js            # Web Audio procedural SFX & music
    ├── physics.js          # Vehicle dynamics, lanes, collision helpers
    ├── weather.js          # Day cycle & weather parameters
    ├── effects.js          # Particles, rain, speedometer paint, shake
    ├── renderer.js         # Three.js world, road, scenery, camera
    ├── traffic.js          # Traffic AI, coins, police
    ├── missions.js         # Missions, combo, run score helpers
    ├── garage.js           # Vehicle catalog, meshes, garage preview
    ├── ui.js               # Screens, HUD, registration, panels
    └── engine.js           # Game loop, input, intro, race lifecycle
```

### What each core file does

| File | Role |
|------|------|
| `index.html` | DOM for splash, registration, vehicle select, menus, HUD, pause, game over |
| `style.css` | Premium glassmorphism look, responsive rules, transitions |
| `main.js` | Connects UI actions to storage, garage controllers, and engine |
| `js/engine.js` | Main loop, intro/countdown, pause, end-run rewards |
| `js/renderer.js` | Three.js scene (road, world, lighting, player mesh) |
| `js/physics.js` | Speed, steering, nitro, fuel, damage helpers |
| `js/traffic.js` | Other cars, collectibles, police |
| `js/garage.js` | Car stats, paint palette, 3D previews |
| `js/storage.js` | Persistence layer |
| `js/ui.js` | Menu navigation and HUD updates |
| `js/audio.js` | Procedural engine, UI, and ambient sound |
| `js/weather.js` | Lighting/fog/weather state |
| `js/effects.js` | FX and 2D speedo |
| `js/missions.js` | Objectives and combos |

---

## Tech stack

- HTML5 · CSS3 · JavaScript (ES2024-friendly)
- [Three.js](https://threejs.org/) (CDN) — 3D
- [GSAP](https://greensock.com/gsap/) (CDN) — UI motion
- Web Audio API — procedural audio
- LocalStorage — saves  
- **No backend · No build step required**

---

## How to run locally

### Option 1 — Python (recommended)

```bat
cd C:\Users\windows\HighwayRacerUltimate
py -m http.server 8080
```

Or:

```bat
python -m http.server 8080
```

Open: **http://localhost:8080**

> Important: run `cd` and `python` as **two steps** (or use `&&`), not on one broken path.

Windows helper: double-click **`start-server.bat`**.

### Option 2 — VS Code / Cursor Live Server

1. Open the `HighwayRacerUltimate` folder in the editor.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html` → **Open with Live Server**.

### Option 3 — Direct file

Double-click **`open-game.bat`** or open `index.html` in the browser.  
(CDN scripts need internet; a local server is more reliable.)

### Option 4 — Node

```bat
npx --yes serve . -p 8080
```

---

## How to clone

```bash
git clone https://github.com/tnaren612/highway-racer-ultimate.git
cd highway-racer-ultimate
```

Then start any local server above.

---

## Deploy to GitHub Pages

### Automatic (Windows)

1. Install [Git](https://git-scm.com/) and [GitHub CLI](https://cli.github.com/).
2. Run `gh auth login` once.
3. Double-click **`deploy-github.bat`**.

### Manual

```bash
cd HighwayRacerUltimate
git init
git branch -M main
git add .
git commit -m "Deploy Highway Racer Ultimate"
git remote add origin https://github.com/tnaren612/highway-racer-ultimate.git
git push -u origin main
```

On GitHub:

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Save

Site URL:

`https://tnaren612.github.io/highway-racer-ultimate/`

(`.nojekyll` is included so all static files serve correctly.)

### How to update the website

```bash
cd HighwayRacerUltimate
git add .
git commit -m "Describe your changes"
git push origin main
```

Wait 1–3 minutes for Pages to rebuild.

---

## License

MIT License — see [LICENSE](./LICENSE).

---

## Credits

- **Design & development:** Narendra Thodeti  
- Presentation inspired by modern premium browser highway racers  
- All game code, UI, and procedural assets are original to this project  

---

## Support

Issues: open a ticket on the [GitHub repository](https://github.com/tnaren612/highway-racer-ultimate).
