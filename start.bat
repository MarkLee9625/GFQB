@echo off
title GongFa Editor

echo.
echo ============================================
echo     GongFa Editor - Start All
echo     Frontend :4512 + BFF :4513
echo ============================================
echo.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0start.ps1"

echo.
pause >nul