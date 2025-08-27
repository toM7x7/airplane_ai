@echo off
setlocal
cd /d "%~dp0..\services\tts-explain"
if not exist .venv\Scripts\python.exe (
  echo Python venv not found. Creating...
  py -3 -m venv .venv
)
".venv\Scripts\python.exe" -m uvicorn main:app --port 8081

