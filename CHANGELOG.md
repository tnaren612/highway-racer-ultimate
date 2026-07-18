# Changelog

All notable changes to **Highway Racer Ultimate** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

---

## [1.2.1] — 2026-07-18

### Improved (environment only)

- Countryside highway art direction: vibrant greens, rolling multi-layer hills, soft fog
- Visual 4-lane asphalt with wide shoulders (physics/gameplay lanes unchanged)
- Asymmetric roadsides: left farms/flowers/lakes/fences; right forest/pines/palms/windmills/rivers
- Vegetation set: oak, pine, palm, coconut, mango, bamboo, bushes, wildflowers, gardens
- Scenic details: cabins, colorful houses, farms, bus stops, petrol, signs, lights, bridges, waterfalls
- Animation: tree sway, windmills, birds, butterflies, flowing water, waterfall shimmer
- Wet road reflections + puddles; rainbow after rain (existing weather systems)

## [1.2.0] — 2026-07-18

### Added

- Living procedural world biomes and roadside systems
- Expanded traffic vehicle types
- Cinematic weather + graphics quality presets
- Ambient environment audio and particles

---

## [1.1.0] — 2026-07-18

### Added

- First-time **driver registration** (name required before garage)
- Pre-race **vehicle selection** with rotating 3D preview
- **Paint selection** (10 colors) with live preview and LocalStorage save
- **Cinematic race intro** (camera push, garage exit, lane align)
- **Countdown** 3 · 2 · 1 · GO! with controls locked until GO
- Designer watermark: **Designed by Narendra Thodeti** on all screens
- Settings: Change Driver Name, Fullscreen, Sound/Music, Graphics, Reset
- HUD pause button
- GitHub Pages helpers (`.nojekyll`, `deploy-github.bat`)
- Professional documentation set (`README.md`, `CHANGELOG.md`, `RELEASE_NOTES.md`, `LICENSE`)
- Windows helpers: `start-server.bat`, `install-python.bat`, `open-game.bat`
- Static verification script `verify.mjs`

### Improved

- Menu spacing, transitions, button hover/focus states
- Mobile-friendly registration, vehicle select, and watermark
- Garage always restores selected vehicle, paint, and upgrades
- Splash / ENTER GAME → name → garage → START RACE flow
- LocalStorage profile flags and validation (min 2-character name)
- **Device-adaptive getting started**: `100dvh` / visualViewport, safe-area padding, onboarding step strip
- Registration modal keyboard-safe (no forced focus jump on touch; sticky CTA)
- Vehicle select stacks on phones, sticky START RACE, horizontal class chips, canvas ResizeObserver
- Landscape short-viewport and coarse-pointer (touch) hit-target rules

### Fixed

- Car select no longer reachable without a registered driver name
- Intro state cleaned on game over / quit
- Paint palette order and vehicle catalog order (Sedan → Electric)
- Continue button disabled until valid name is entered
- Coin mission progress no longer double-counts session totals
- Clean-distance missions track undamaged stretch correctly after impacts
- Profile name save requires 2+ characters (same rules as registration)
- Short/blank saved names force re-registration on load
- Register / exit overlays use fixed full-viewport positioning
- Gamepad pause ignored during intro until controls unlock

### Unchanged (by design)

- Traffic AI, core physics model, weather simulation, Three.js world renderer architecture, and core gameplay systems remain the production systems from v1.0

---

## [1.0.0] — 2026-07

### Added

- Initial premium browser build
- Three.js infinite highway, vehicles, traffic, weather
- Full menu suite: garage, profile, achievements, stats, leaderboard, daily rewards, settings
- Procedural Web Audio
- LocalStorage progression
- Keyboard, touch, and gamepad input
