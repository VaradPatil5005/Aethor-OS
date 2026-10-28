@echo off
REM One-click AetherOS + SpillGuard demo. Double-click this file.
cd /d "%~dp0"
title AetherOS + SpillGuard demo

if not exist "dist\index.html" (
  echo Building AetherOS...
  call npm run build || goto :fail
)

if exist "agent\.venv\Scripts\python.exe" (
  echo Starting SpillGuard agent + AetherOS. Your browser will open automatically.
  echo Keep this window open during the demo. Press Ctrl+C here to stop.
  cd agent
  ".venv\Scripts\python.exe" -m spillguard serve --trace ""
  goto :eof
)

echo SpillGuard agent environment not found - starting AetherOS only (Replay demo still works).
start "" http://localhost:4173/
call npx vite preview --port 4173
goto :eof

:fail
echo Build failed. Run "npm install" first, then double-click this file again.
pause
