@echo off
:: ============================================================
:: Evenfield — Windows Task Scheduler Setup
:: ============================================================
:: Run this file ONCE as Administrator to create all scheduled
:: tasks. It will set up pipelines that run automatically and
:: deploy to Vercel after each run.
::
:: Prerequisites:
::   1. Python in PATH (test: python --version)
::   2. ANTHROPIC_API_KEY set as a SYSTEM environment variable:
::        Win+R -> sysdm.cpl -> Advanced -> Environment Variables
::        -> System Variables -> New -> ANTHROPIC_API_KEY = your_key
::   3. RESEND_API_KEY set the same way (for email digest)
::   4. Vercel CLI: npm install -g vercel && vercel login
::   5. Run this file: right-click -> Run as administrator
::
:: Tasks created:
::   Evenfield-Pipeline       every 2 hours  (Form 4 insider filings)
::   Evenfield-Congressional  every 4 hours  (STOCK Act trades)
::   Evenfield-Lobbying       daily at 6 AM  (federal contracts)
::   Evenfield-Digest         daily at 7 AM  (email digest)
::
:: After running, verify with:
::   schtasks /query /tn "Evenfield-Pipeline"
:: ============================================================

SET PROJECT=%~dp0
:: Remove trailing backslash
IF "%PROJECT:~-1%"=="\" SET PROJECT=%PROJECT:~0,-1%

SET PYTHON=python
SET VERCEL=npx vercel

echo.
echo ============================================================
echo  Evenfield - Task Scheduler Setup
echo  Project: %PROJECT%
echo ============================================================

:: Create logs directory
IF NOT EXIST "%PROJECT%\logs" MKDIR "%PROJECT%\logs"
echo  Logs directory: %PROJECT%\logs
echo.

:: ── Task 1: Form 4 Pipeline (every 2 hours) ──────────────────
echo [1/4] Evenfield-Pipeline (every 2h, Form 4 insider filings)
schtasks /delete /tn "Evenfield-Pipeline" /f >nul 2>&1
schtasks /create ^
  /tn "Evenfield-Pipeline" ^
  /tr "cmd /c cd /d \"%PROJECT%\" && %PYTHON% pipeline.py && %PYTHON% enrichment.py insider && copy /Y evenfield_enriched.json web\public\evenfield_enriched.json && cd web && %VERCEL% deploy --prod >> \"%PROJECT%\logs\pipeline.log\" 2>&1" ^
  /sc HOURLY /mo 2 /st 00:00 ^
  /ru "%USERDOMAIN%\%USERNAME%" ^
  /f
IF %ERRORLEVEL% EQU 0 (echo      Created OK) ELSE (echo      FAILED ^(run as Administrator^))

:: ── Task 2: Congressional Pipeline (every 4 hours) ───────────
echo [2/4] Evenfield-Congressional (every 4h, STOCK Act trades)
schtasks /delete /tn "Evenfield-Congressional" /f >nul 2>&1
schtasks /create ^
  /tn "Evenfield-Congressional" ^
  /tr "cmd /c cd /d \"%PROJECT%\" && %PYTHON% congressional_pipeline.py && %PYTHON% enrichment.py congressional && copy /Y congressional_enriched.json web\public\congressional_enriched.json && cd web && %VERCEL% deploy --prod >> \"%PROJECT%\logs\congressional.log\" 2>&1" ^
  /sc HOURLY /mo 4 /st 00:00 ^
  /ru "%USERDOMAIN%\%USERNAME%" ^
  /f
IF %ERRORLEVEL% EQU 0 (echo      Created OK) ELSE (echo      FAILED ^(run as Administrator^))

:: ── Task 3: Lobbying Pipeline (daily at 6 AM) ────────────────
echo [3/4] Evenfield-Lobbying (daily 6:00 AM, federal contracts)
schtasks /delete /tn "Evenfield-Lobbying" /f >nul 2>&1
schtasks /create ^
  /tn "Evenfield-Lobbying" ^
  /tr "cmd /c cd /d \"%PROJECT%\" && %PYTHON% lobbying_pipeline.py && copy /Y lobbying_data.json web\public\lobbying_data.json && cd web && %VERCEL% deploy --prod >> \"%PROJECT%\logs\lobbying.log\" 2>&1" ^
  /sc DAILY /st 06:00 ^
  /ru "%USERDOMAIN%\%USERNAME%" ^
  /f
IF %ERRORLEVEL% EQU 0 (echo      Created OK) ELSE (echo      FAILED ^(run as Administrator^))

:: ── Task 4: Daily Email Digest (daily at 7 AM) ───────────────
echo [4/4] Evenfield-Digest (daily 7:00 AM, email digest)
schtasks /delete /tn "Evenfield-Digest" /f >nul 2>&1
schtasks /create ^
  /tn "Evenfield-Digest" ^
  /tr "cmd /c cd /d \"%PROJECT%\" && %PYTHON% alerts.py --digest >> \"%PROJECT%\logs\digest.log\" 2>&1" ^
  /sc DAILY /st 07:00 ^
  /ru "%USERDOMAIN%\%USERNAME%" ^
  /f
IF %ERRORLEVEL% EQU 0 (echo      Created OK) ELSE (echo      FAILED ^(run as Administrator^))

echo.
echo ============================================================
echo  Setup complete. Scheduled tasks:
echo.
echo  Every 2h  - Evenfield-Pipeline       (Form 4 filings)
echo  Every 4h  - Evenfield-Congressional  (STOCK Act trades)
echo  Daily 6am - Evenfield-Lobbying       (federal contracts)
echo  Daily 7am - Evenfield-Digest         (email digest)
echo.
echo  Run all pipelines manually now:
echo    run_pipeline.bat
echo.
echo  Check task status:
echo    schtasks /query /fo LIST /tn "Evenfield-Pipeline"
echo ============================================================
pause
