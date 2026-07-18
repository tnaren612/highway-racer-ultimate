@echo off
setlocal EnableExtensions
title Git commit and push - Highway Racer Ultimate
cd /d "%~dp0"

echo ============================================
echo   Git: commit + push to GitHub
echo ============================================
echo.

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Git is not installed.
  echo Download: https://git-scm.com/download/win
  start https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing git repository...
  git init
  git branch -M main
)

echo.
echo Staging all files...
git add .

echo.
echo Committing...
git commit -m "Added player onboarding, garage flow, documentation and improvements"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [INFO] Commit may have failed because there is nothing new to commit,
  echo        or user.name / user.email is not configured.
  echo.
  echo Configure once:
  echo   git config --global user.name "Narendra Thodeti"
  echo   git config --global user.email "your-email@example.com"
  echo.
)

echo.
echo Checking remote...
git remote get-url origin >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Adding origin https://github.com/tnaren612/highway-racer-ultimate.git
  git remote add origin https://github.com/tnaren612/highway-racer-ultimate.git
)

echo.
echo Pushing to origin main...
echo (If Git asks for login, complete authentication in the browser / credential prompt.)
echo.
git push -u origin main
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ============================================
  echo PUSH FAILED - authentication may be required
  echo ============================================
  echo.
  echo Do NOT share passwords or tokens with AI tools.
  echo.
  echo Options:
  echo   1. Install GitHub CLI and run:  gh auth login
  echo   2. Or push with GitHub Desktop
  echo   3. Or use a Personal Access Token when Git prompts for a password
  echo      https://github.com/settings/tokens
  echo.
  echo After login, run this file again:
  echo   commit-and-push.bat
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo SUCCESS
echo Repo:  https://github.com/tnaren612/highway-racer-ultimate
echo Pages: https://tnaren612.github.io/highway-racer-ultimate/
echo ============================================
echo.
echo Enable Pages if needed: Settings -^> Pages -^> Branch main / root
echo.
pause
endlocal
