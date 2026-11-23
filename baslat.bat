@echo off
chcp 65001 >nul
title Pit Duvari
rem Pit Duvari: yerel sunucuyu baslatir ve tarayiciyi acar. Kapatmak icin "Pit Duvari sunucu" penceresini kapat.
cd /d "%~dp0"
where git >nul 2>nul && git pull --quiet 2>nul
set "NODE=node"
if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
start "Pit Duvari sunucu" /min "%NODE%" "%~dp0scripts\serve.mjs" 8777
timeout /t 2 /nobreak >nul
start "" "http://localhost:8777/"
