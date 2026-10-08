@echo off
rem ============================================================
rem  Fix "phone connected but adb cannot see it" (Windows side).
rem  Double-click -> click "Yes" on the UAC prompt.
rem  Runs fix-adb-usb.ps1 from this same folder, with admin rights.
rem  See fix-adb-usb.ps1 header for the full root-cause story.
rem ============================================================
title Fix ADB USB (run as admin)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0fix-adb-usb.ps1'"
echo.
echo If nothing popped up, open Terminal (Admin) manually and run:
echo   powershell -ExecutionPolicy Bypass -File "%~dp0fix-adb-usb.ps1"
echo.
timeout /t 8 >nul
