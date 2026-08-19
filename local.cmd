@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\huly-local-stack.ps1"
if errorlevel 1 pause
