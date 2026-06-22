@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

cls
echo ==============================
echo   YourHonor AI -- Setup
echo ==============================
echo.

REM -- Check Docker --
echo Checking Docker...
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Docker is not installed.
  echo Download and install Docker Desktop from:
  echo   https://www.docker.com/products/docker-desktop/
  echo Then run this setup again.
  pause
  exit /b 1
)

docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Docker is installed but not running.
  echo Open Docker Desktop from your Start menu and wait
  echo for the whale icon to appear in the system tray.
  pause
  exit /b 1
)
echo   [OK] Docker is installed and running.
echo.

REM -- OpenRouter API Key --
echo --- OpenRouter API Key --------------------------------
echo.
echo YourHonor AI uses the Qwen3-14B AI model through OpenRouter.
echo This requires an API key with at least $5 in credits.
echo.
echo To get your key:
echo   1. Go to https://openrouter.ai/keys
echo   2. Click 'Sign Up' and create an account
echo   3. Click '[+ Create Key]' and copy the key
echo   4. Go to https://openrouter.ai/settings/credits
echo   5. Add $5 in credits (lasts thousands of responses)
echo.
set /p OR_KEY="Paste your OpenRouter API key (sk-or-v1-...): "
echo.

if "%OR_KEY%"=="" (
  echo ERROR: No key entered. You must provide an OpenRouter API key.
  pause
  exit /b 1
)

REM -- CourtListener (Optional) --
echo --- CourtListener Token (Optional) --------------------
echo.
echo YourHonor AI comes with 24 landmark US Supreme Court
echo cases pre-loaded, including:
echo   - Gideon v. Wainwright (right to counsel)
echo   - Miranda v. Arizona (right to silence)
echo   - Roe v. Wade / Dobbs v. Jackson (abortion)
echo   - Obergefell v. Hodges (same-sex marriage)
echo   - Brown v. Board of Education
echo   - ...and 19 more.
echo.
echo These 24 cases are enough for most law school assignments.
echo.
echo If you want to search ADDITIONAL cases -- like a case
echo your professor assigned or a state court case -- you can
echo connect to CourtListener, a free database of millions of
echo US court opinions from federal and state courts.
echo.
echo How to get a CourtListener token (2 minutes):
echo   1. Go to https://www.courtlistener.com/
echo   2. Click 'Register' and create a free account
echo   3. Confirm your email
echo   4. Log in, click your username -^> 'Profile'
echo   5. Scroll down to the 'API' section
echo   6. Copy the token shown there
echo.
echo The free tier allows 1,000 requests per day -- plenty for
echo classroom use.
echo.
set /p CL_TOKEN="Paste your CourtListener token, or press Enter to skip: "
echo.

REM -- Write .env --
echo Creating .env file...

(
  echo OPENROUTER_API_KEY=%OR_KEY%
) > .env

if not "%CL_TOKEN%"=="" (
  echo COURTLISTENER_TOKEN=%CL_TOKEN% >> .env
  echo   [OK] OpenRouter key + CourtListener token saved.
) else (
  echo   [OK] OpenRouter key saved. Skipping CourtListener.
  echo   The 24 pre-loaded cases are ready to use.
)

echo.
echo ==============================
echo   Setup complete!
echo.
echo   Next step: Double-click start.bat
echo ==============================
pause
