@echo off
setlocal
REM Start flight-proxy in a new window
start "flight-proxy" cmd /k "cd /d %~dp0..\services\flight-proxy && node index.js"
REM Start web server and open browser
call "%~dp0start_web.bat"
echo Started flight-proxy and web server.
exit /b 0

