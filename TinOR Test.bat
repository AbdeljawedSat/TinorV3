@echo off
REM TinOR - version TEST (essais, formation) : base du fichier .env.test, port 3002.
REM La fenetre TinOR s'ouvre dans le navigateur des que le serveur est pret.
title TinOR - TEST (port 3002)
cd /d "%~dp0"
call npm.cmd run migrate:test
start "" /min cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3002/"
call npm.cmd run start:test
pause
