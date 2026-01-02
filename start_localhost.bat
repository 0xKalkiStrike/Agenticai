@echo off
echo ========================================
echo   IT Support System - Localhost Setup
echo ========================================
echo.

echo Checking WAMP server...
python -c "import mysql.connector; mysql.connector.connect(host='localhost', user='root', password='', port=3306)" 2>nul
if errorlevel 1 (
    echo ❌ WAMP server is not running!
    echo    Please start WAMP server and ensure MySQL is running
    echo    Then run: py setup_localhost_wamp.py
    pause
    exit /b 1
)

echo ✅ WAMP server is running
echo.

echo Choose an option:
echo 1. Setup database (first time only)
echo 2. Start backend only
echo 3. Start frontend only  
echo 4. Start both (recommended)
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo Setting up database...
    py setup_localhost_wamp.py
    pause
) else if "%choice%"=="2" (
    echo Starting backend...
    py backend/app/main.py
) else if "%choice%"=="3" (
    echo Starting frontend...
    npm run dev
) else if "%choice%"=="4" (
    echo Starting both backend and frontend...
    echo Backend will start at: http://localhost:8001
    echo Frontend will start at: http://localhost:3000
    echo.
    start "Backend" cmd /k "py backend/app/main.py"
    timeout /t 3 /nobreak >nul
    start "Frontend" cmd /k "npm run dev"
    echo Both services started in separate windows
    pause
) else (
    echo Invalid choice
    pause
)