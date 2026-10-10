@echo off
REM TinOR - version TEST (essais, formation) : base du fichier .env.test, port 3002.
title TinOR - TEST (port 3002)
cd /d "%~dp0"
call npm.cmd run migrate:test
call npm.cmd run start:test
pause
