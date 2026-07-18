# Release Notes — Highway Racer Ultimate v1.1.0

**Release date:** 2026-07-18  
**Author:** Narendra Thodeti  
**Repository:** https://github.com/tnaren612/highway-racer-ultimate  

---

## Highlights

This release delivers a complete **onboarding and garage pre-race flow**, cinematic **race start**, UI polish, and full project documentation for local play and GitHub Pages.

### Player journey

1. Splash screen  
2. **ENTER GAME**  
3. Driver name (first time only)  
4. Vehicle selection  
5. Paint selection  
6. **START RACE**  
7. Cinematic camera + **3 · 2 · 1 · GO!**  
8. Gameplay  

### What’s new for players

- Name is saved; you are not asked again unless you reset or change name in Settings  
- Pick any unlocked car and color before every run  
- Premium glass UI with smoother transitions and mobile layout fixes  
- Corner watermark: **Designed by Narendra Thodeti**  

### What’s new for developers / deployers

- Complete `README.md` (features, controls, structure, deployment)  
- `CHANGELOG.md`, `LICENSE` (MIT), `.gitignore`, `.nojekyll`  
- Windows batch helpers for Python server and GitHub deploy  
- `verify.mjs` for static project checks  

---

## Compatibility

- Modern Chromium, Firefox, Safari, Edge  
- Desktop keyboard + gamepad  
- Mobile touch controls  
- Requires network only for CDN libraries (Three.js, GSAP, Google Fonts)  

---

## Patch notes (inspection fixes)

- Coin / clean-distance mission progress corrected  
- Profile rename matches 2-character registration rules  
- Body-level overlays (register / exit) use fixed positioning  
- Gamepad pause blocked until countdown GO  

## Known notes

- Progress is **browser-local** (LocalStorage); it does not sync across devices  
- GitHub Pages may take a few minutes after push to update  
- If Python is missing on Windows, use `install-python.bat` or open `index.html` via Live Server  

---

## Upgrade from 1.0

No migration script required. Existing saves merge with new fields (`profileRegistered`, `selectedColor`). Players without a valid name will be prompted once.

---

## Thank you

Enjoy the highway — designed by **Narendra Thodeti**.
