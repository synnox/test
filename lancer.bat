@echo off
title Sn Streaming
echo ========================================
echo         Sn Streaming - Lancement
echo ========================================
echo.
echo Ouverture du site dans le navigateur...
start "" "%~dp0index.html"
echo.
echo Site ouvert ! Vous pouvez fermer cette fenetre.
timeout /t 3 >nul