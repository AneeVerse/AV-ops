@echo off
REM One command to deploy aneeverse Huly to production.
REM   deploy.cmd            validate -> build -> ship -> smoke (skips unchanged stages)
REM   deploy.cmd status     show what would be deployed
REM   deploy.cmd rollback   go back to the previous front image
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\aneeverse-deploy.ps1" %*
set "RC=%errorlevel%"
if not "%RC%"=="0" (
  echo.
  echo Deploy failed with exit code %RC%.
  if "%HULY_NO_PAUSE%"=="" pause
)
exit /b %RC%
