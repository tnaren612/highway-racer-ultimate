@echo off
setlocal EnableExtensions
title Highway Racer Ultimate - Local Server
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://localhost:%PORT%"

echo ============================================
echo   Highway Racer Ultimate
echo   Local server on %URL%
echo ============================================
echo.
echo Project folder:
echo   %CD%
echo.

if not exist "index.html" (
  echo [ERROR] index.html not found in this folder.
  echo Make sure this file is inside HighwayRacerUltimate.
  pause
  exit /b 1
)

REM Prefer py launcher, then python
set "PYEXE="
where py >nul 2>&1
if %ERRORLEVEL%==0 set "PYEXE=py"

if not defined PYEXE (
  where python >nul 2>&1
  if %ERRORLEVEL%==0 set "PYEXE=python"
)

if not defined PYEXE (
  echo [ERROR] Python is not installed or not on PATH.
  echo.
  echo Double-click  install-python.bat  first, then try again.
  echo Or install from https://www.python.org/downloads/
  echo ^(check "Add python.exe to PATH"^)
  echo.
  if exist "%~dp0install-python.bat" (
    choice /C YN /M "Run install-python.bat now"
    if errorlevel 2 goto :fail
    if errorlevel 1 call "%~dp0install-python.bat"
  )
  pause
  exit /b 1
)

echo [OK] Using: %PYEXE%
%PYEXE% --version 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Could not run Python.
  pause
  exit /b 1
)

echo.
echo Starting server...
echo Keep this window OPEN while you play.
echo Press Ctrl+C to stop the server.
echo.
echo Opening browser in 2 seconds...
echo.

REM Open browser after a short delay in a separate process
start "" cmd /c "timeout /t 2 /nobreak >nul & start %URL%"

REM Bind to all interfaces so localhost works reliably
%PYEXE% -m http.server %PORT% --bind 127.0.0.1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Server failed to start on port %PORT%.
  echo Trying port 5500 instead...
  set "PORT=5500"
  set "URL=http://localhost:5500"
  start "" cmd /c "timeout /t 1 /nobreak >nul & start %URL%"
  %PYEXE% -m http.server %PORT% --bind 127.0.0.1
  if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Could not start server. Is Python installed correctly?
    pause
    exit /b 1
  )
)

goto :eof

:fail
echo Cancelled.
pause
exit /b 1
