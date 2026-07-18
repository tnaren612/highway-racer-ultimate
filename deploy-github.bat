@echo off
setlocal EnableExtensions
title Deploy Highway Racer Ultimate to GitHub Pages
cd /d "%~dp0"

echo ============================================
echo   Deploy to GitHub - tnaren612
echo ============================================
echo.

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Git is not installed.
  echo Install from https://git-scm.com/download/win
  start https://git-scm.com/download/win
  pause
  exit /b 1
)

where gh >nul 2>&1
set "HAS_GH=0"
if %ERRORLEVEL%==0 set "HAS_GH=1"

set "REPO_NAME=highway-racer-ultimate"
set "GITHUB_USER=tnaren612"

echo This will:
echo   1. Create a git repo in this folder (if needed)
echo   2. Commit the game files
echo   3. Create/push repo %GITHUB_USER%/%REPO_NAME%
echo   4. Enable GitHub Pages (if gh CLI is logged in)
echo.
echo Live URL will be:
echo   https://%GITHUB_USER%.github.io/%REPO_NAME%/
echo.
pause

if not exist ".git" (
  git init
  git branch -M main
)

git add -A
git status
git commit -m "Highway Racer Ultimate - Designed by Narendra Thodeti" 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [INFO] Nothing new to commit or commit failed - continuing...
)

if "%HAS_GH%"=="1" (
  echo.
  echo Checking GitHub login...
  gh auth status
  if %ERRORLEVEL% NEQ 0 (
    echo Please login:
    gh auth login
  )

  REM Create repo if missing, then push
  gh repo view %GITHUB_USER%/%REPO_NAME% >nul 2>&1
  if %ERRORLEVEL% NEQ 0 (
    echo Creating public repo %REPO_NAME%...
    gh repo create %GITHUB_USER%/%REPO_NAME% --public --source=. --remote=origin --push
  ) else (
    git remote remove origin 2>nul
    git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git 2>nul
    git push -u origin main
  )

  echo Enabling GitHub Pages (main branch / root)...
  gh api -X POST "repos/%GITHUB_USER%/%REPO_NAME%/pages" -f build_type=legacy -f source[branch]=main -f source[path]=/ 2>nul
  gh api -X PUT "repos/%GITHUB_USER%/%REPO_NAME%/pages" -f build_type=legacy -f source[branch]=main -f source[path]=/ 2>nul

  echo.
  echo ============================================
  echo DONE
  echo Repo:  https://github.com/%GITHUB_USER%/%REPO_NAME%
  echo Live:  https://%GITHUB_USER%.github.io/%REPO_NAME%/
  echo (Pages may take 1-3 minutes to go live)
  echo ============================================
  start https://github.com/%GITHUB_USER%/%REPO_NAME%
  start https://%GITHUB_USER%.github.io/%REPO_NAME%/
) else (
  echo.
  echo [WARN] GitHub CLI (gh) not found.
  echo Manual deploy:
  echo   1. Create repo https://github.com/new name: %REPO_NAME% (public)
  echo   2. Run:
  echo      git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git
  echo      git push -u origin main
  echo   3. Repo Settings -^> Pages -^> Branch: main / root -^> Save
  echo.
  echo Install gh for auto deploy: https://cli.github.com/
  start https://github.com/new
)

echo.
pause
endlocal
