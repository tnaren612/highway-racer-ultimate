@echo off
setlocal EnableExtensions
title Highway Racer Ultimate - Install Python
cd /d "%~dp0"

echo ============================================
echo   Highway Racer Ultimate - Python Setup
echo ============================================
echo.

REM Already installed?
where python >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [OK] Python is already on PATH.
  python --version
  goto :done
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [OK] Python launcher "py" is available.
  py --version
  goto :done
)

echo [..] Python not found. Trying winget install...
where winget >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] winget is not available.
  echo Install Python manually:
  echo   1. Open https://www.python.org/downloads/
  echo   2. Download Python 3.12+ for Windows
  echo   3. Run installer and CHECK "Add python.exe to PATH"
  echo   4. Close this window, open a NEW terminal, run start-server.bat
  echo.
  start https://www.python.org/downloads/
  pause
  exit /b 1
)

echo.
echo Installing Python 3.12 via winget (may need approval)...
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [WARN] winget install failed. Opening python.org download page...
  start https://www.python.org/downloads/
  echo Install Python, enable "Add to PATH", then run start-server.bat
  pause
  exit /b 1
)

echo.
echo [OK] Install finished. Refreshing PATH for this session...
set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;%PATH%"

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python --version
  goto :done
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py --version
  goto :done
)

echo.
echo [NOTE] Python installed but PATH not updated in this window yet.
echo Close this window, then double-click start-server.bat
echo.

:done
echo.
echo Next step: double-click  start-server.bat
echo That will start the server and open http://localhost:8080
echo.
pause
endlocal
