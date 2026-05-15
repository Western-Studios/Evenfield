@echo off
:: ============================================================
:: Evenfield — Manual Pipeline Runner
:: ============================================================
:: Runs all three pipelines immediately in sequence and deploys.
:: Usage: double-click or run from command prompt.
:: ============================================================

SET PROJECT=%~dp0
IF "%PROJECT:~-1%"=="\" SET PROJECT=%PROJECT:~0,-1%

cd /d "%PROJECT%"

IF NOT EXIST "%PROJECT%\logs" MKDIR "%PROJECT%\logs"

echo.
echo ============================================================
echo  Evenfield - Running All Pipelines
echo  %DATE% %TIME%
echo ============================================================

:: ── 1: Form 4 Insider Pipeline ───────────────────────────────
echo.
echo [1/3] Form 4 Insider Filings (SEC EDGAR)
echo ------------------------------------------------------------
python pipeline.py
IF %ERRORLEVEL% NEQ 0 (echo  ERROR in pipeline.py & GOTO :error)

python enrichment.py insider
IF %ERRORLEVEL% NEQ 0 (echo  ERROR in enrichment.py insider & GOTO :error)

copy /Y evenfield_enriched.json web\public\evenfield_enriched.json >nul
echo  Copied: evenfield_enriched.json -> web/public/

:: ── 2: Congressional Pipeline ────────────────────────────────
echo.
echo [2/3] Congressional STOCK Act Trades
echo ------------------------------------------------------------
python congressional_pipeline.py
IF %ERRORLEVEL% NEQ 0 (echo  ERROR in congressional_pipeline.py & GOTO :error)

python enrichment.py congressional
IF %ERRORLEVEL% NEQ 0 (echo  ERROR in enrichment.py congressional & GOTO :error)

copy /Y congressional_enriched.json web\public\congressional_enriched.json >nul
echo  Copied: congressional_enriched.json -> web/public/

:: ── 3: Lobbying / Federal Contracts Pipeline ─────────────────
echo.
echo [3/3] Federal Contracts (USASpending.gov)
echo ------------------------------------------------------------
python lobbying_pipeline.py
IF %ERRORLEVEL% NEQ 0 (echo  ERROR in lobbying_pipeline.py & GOTO :error)

copy /Y lobbying_data.json web\public\lobbying_data.json >nul
echo  Copied: lobbying_data.json -> web/public/

:: ── Deploy to Vercel ─────────────────────────────────────────
echo.
echo ------------------------------------------------------------
echo  Deploying to Vercel...
echo ------------------------------------------------------------
cd web
npx vercel deploy --prod
IF %ERRORLEVEL% NEQ 0 (echo  WARNING: Vercel deploy failed — data files updated locally)
cd ..

echo.
echo ============================================================
echo  All pipelines complete. %DATE% %TIME%
echo ============================================================
GOTO :end

:error
echo.
echo ============================================================
echo  Pipeline run FAILED. Check errors above.
echo ============================================================

:end
pause
