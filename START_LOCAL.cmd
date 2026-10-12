@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 투자 나침반 로컬 서버를 시작합니다.
echo 잠시 후 브라우저가 열립니다. 종료하려면 이 창을 닫으세요.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4173"
node server.mjs
pause
