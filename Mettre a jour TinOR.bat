@echo off
REM Met TinOR a jour depuis GitHub (code, fenetre, scripts SQL).
REM Vos donnees (base MariaDB), .env, .env.test et backups ne sont pas touches.
REM Le script se recopie dans %TEMP% : il peut ainsi se mettre a jour lui-meme.
if /i not "%~1"=="--copie" (
  copy /y "%~f0" "%TEMP%\tinor_mise_a_jour.bat" >nul
  call "%TEMP%\tinor_mise_a_jour.bat" --copie "%~dp0"
  exit /b
)
title TinOR - Mise a jour
cd /d "%~2"
echo.
echo  === Mise a jour de TinOR depuis GitHub ===
echo.
echo  Version actuelle :
git log -1 --format="    %%h  du %%cd  -  %%s" --date=format:"%%d/%%m/%%Y %%H:%%M"
echo.
git fetch origin main || goto erreur
REM Modifications locales eventuelles mises de cote (recuperables par "git stash list").
git stash push -m "avant mise a jour %date% %time%" >nul 2>&1
git reset --hard origin/main || goto erreur
echo.
echo  Installation des composants...
call npm.cmd install --no-audit --no-fund || goto erreur
echo.
echo  Nouvelle version installee :
git log -1 --format="    %%h  du %%cd  -  %%s" --date=format:"%%d/%%m/%%Y %%H:%%M"
echo.
echo  ETAPE SUIVANTE : fermez la fenetre noire de TinOR si elle est ouverte,
echo  puis relancez TinOR.bat. Dans le navigateur : Ctrl+F5.
echo.
pause
exit /b 0
:erreur
echo.
echo  ECHEC de la mise a jour. Envoyez une capture de cette fenetre.
echo.
pause
exit /b 1
