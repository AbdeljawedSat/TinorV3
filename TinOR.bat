@echo off
REM TinOR - version REELLE (vos vraies donnees) : base du fichier .env, port 3001.
title TinOR - REEL (port 3001)
cd /d "%~dp0"
call npm.cmd run migrate
call npm.cmd start
pause
