@echo off
title Sn Streaming - Serveur local
color 0b
echo ==================================================
echo          Sn Streaming - Serveur local + proxy
echo ==================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto neednode

echo Verification du port 8766...

netstat -ano | findstr ":8766" | findstr "LISTENING" >nul 2>nul
if errorlevel 1 goto startserver

echo Le serveur tourne deja (port 8766).
goto open

:startserver
start "Sn Streaming serveur" /min cmd /c "node server.js"
timeout /t 1 >nul

:open
start "" "http://127.0.0.1:8766/index.html"

echo.
echo  Serveur :  http://127.0.0.1:8766/
echo  Pour arreter le serveur : fermer la fenetre "Sn Streaming serveur".
echo.
endlocal

:neednode
echo [ERREUR] Node.js introuvable. Installe-le depuis https://nodejs.org/
pause
exit /b 1