@echo off
echo YouTube Pulse 실행 중...
echo.

cd /d "%~dp0"

echo 기존 프로세스 종료 중...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo 포트 8080 확인 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do (
    echo 포트 8080을 사용하는 프로세스 종료: %%a
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo 잠시 기다려주세요...
timeout /t 3 /nobreak > nul

echo 개발 서버 시작 중...
start "YouTube Pulse Server" cmd /c "npm run dev"

echo.
echo 서버가 시작될 때까지 잠시 기다려주세요...
timeout /t 8 /nobreak > nul

echo Electron 앱 실행 중...
start "YouTube Pulse App" cmd /c "npx electron ."

echo.
echo YouTube Pulse가 실행되었습니다!
echo 창이 열리지 않으면 작업 표시줄을 확인해주세요.
echo.
echo 앱을 종료하려면 모든 창을 닫으세요.
timeout /t 3 /nobreak > nul
