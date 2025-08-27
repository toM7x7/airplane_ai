@echo off
setlocal
set PORT=5173
set ROOT=%~dp0..\
pushd "%ROOT%"

where python >nul 2>&1
if errorlevel 1 (
  echo Python not found in PATH. Please install Python 3.10+.
  pause
  exit /b 1
)

REM Launch server in a new window so it stays alive
start "webxr-server" cmd /k "python -m http.server %PORT% --directory webxr"
REM Give it a moment, then open browser
ping -n 2 127.0.0.1 >nul
start "" http://localhost:%PORT%/
echo Started web server at http://localhost:%PORT%/
popd
exit /b 0

