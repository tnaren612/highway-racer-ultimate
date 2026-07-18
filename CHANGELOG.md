# Changelog

All notable changes to **Highway Racer Ultimate** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
