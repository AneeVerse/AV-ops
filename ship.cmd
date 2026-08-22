@echo off
REM Kept for muscle memory — deploy.cmd is the current entry point.
cd /d "%~dp0"
call "%~dp0deploy.cmd" %*
exit /b %errorlevel%
