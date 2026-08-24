@echo off
REM Build the custom account image (server/account code, e.g. API tokens).
REM The local stack and deploy.cmd both use huly-account-custom once it exists.
REM Re-run this after changing anything under server/ or pods/account.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\huly-build-account.ps1" %*
set "RC=%errorlevel%"
if not "%RC%"=="0" (
  echo.
  echo Account image build failed with exit code %RC%.
  if "%HULY_NO_PAUSE%"=="" pause
)
exit /b %RC%
