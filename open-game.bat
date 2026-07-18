@echo off
REM Opens the game without a server (works offline; CDN needs internet for Three.js/GSAP)
cd /d "%~dp0"
if not exist "index.html" (
  echo index.html not found.
  pause
  exit /b 1
)
start "" "%~dp0index.html"
