@echo off
rem Earth Case File - local preview launcher (keep this file ASCII only)
cd /d "%~dp0"
echo.
echo  [Earth Case File] local preview
echo  Student : http://localhost:8123/
echo  Teacher : http://localhost:8123/teacher/
echo.
echo  Keep this window open while testing. Close it to stop.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "server" /min py -m http.server 8123
  goto open
)
where node >nul 2>nul
if %errorlevel%==0 (
  start "server" /min cmd /c npx --yes http-server -p 8123 -c-1
  goto open
)
echo  ERROR: Python or Node.js is needed. Install Python from python.org
pause
exit /b

:open
rem wait until the server is ready
ping -n 4 127.0.0.1 >nul
start "" http://localhost:8123/teacher/
start "" http://localhost:8123/
echo  Opened in the browser. Press any key to stop the server.
pause >nul
taskkill /fi "WINDOWTITLE eq server*" /t /f >nul 2>nul
