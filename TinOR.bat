@echo off
REM TinOR - version REELLE (vos vraies donnees) : base du fichier .env, port 3001.
REM La fenetre TinOR s'ouvre dans le navigateur des que le serveur est pret.
title TinOR - REEL (port 3001)
cd /d "%~dp0"
call npm.cmd run migrate
start "" /min cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3001/"
call npm.cmd start
pause
