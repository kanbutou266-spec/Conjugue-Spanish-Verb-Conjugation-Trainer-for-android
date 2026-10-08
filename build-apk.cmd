@echo off
setlocal
rem =====================================================================
rem  Build a STANDALONE release APK (JS bundle embedded, no Metro needed).
rem
rem  Usage:
rem    build-apk.cmd             ARM64 release (real phones, ~17 MB)
rem    build-apk.cmd x86_64      Emulator build (~19 MB); saved under a
rem                              different name so it never overwrites the
rem                              phone release.
rem    build-apk.cmd all         All 4 ABIs (~85 MB, NOT recommended)
rem
rem  Output:
rem    android\app\build\outputs\apk\release\app-release.apk
rem    .\BianWeiJun-release.apk         (copy, ARM64 builds only)
rem    .\BianWeiJun-release-<abi>.apk   (copy, other ABIs)
rem
rem  Note: the file name is ASCII on purpose. The name shown under the
rem  launcher icon comes from inside the APK (res/values/strings.xml
rem  -> app_name), which is "BianWeiJun" -- not from the file name.
rem =====================================================================
set ABI=%~1
if "%ABI%"=="" set ABI=arm64-v8a

cd /d "%~dp0android"

where java >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] java not found in PATH. JDK 17 is required.
  echo         Set JAVA_HOME, e.g.  set JAVA_HOME=D:\dev\tools\jdk-17
  echo.
  pause
  exit /b 1
)

echo.
echo [1/4] Clearing stale Metro bundle caches (IMPORTANT) ...
echo.
rem Gradle's createBundleReleaseJsAndAssets does NOT track JS source changes:
rem after editing any file under src\, the old bundle is silently reused unless
rem these two directories are removed first. Always clear them before packing.
if exist app\build\generated\assets\react rmdir /s /q app\build\generated\assets\react
if exist app\build\intermediates\assets rmdir /s /q app\build\intermediates\assets

echo.
echo [2/4] Gradle assembleRelease (ABI=%ABI%) ... this can take several minutes.
echo.
call gradlew.bat assembleRelease -PreactNativeArchitectures=%ABI% --console=plain
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Scroll up for the Gradle error.
  echo.
  pause
  exit /b 1
)

set SRC=app\build\outputs\apk\release\app-release.apk
if not exist "%SRC%" (
  echo.
  echo [ERROR] APK not produced at %SRC%
  echo.
  pause
  exit /b 1
)

if /i "%ABI%"=="arm64-v8a" (
  set DEST=..\BianWeiJun-release.apk
) else (
  set DEST=..\BianWeiJun-release-%ABI%.apk
)

echo [3/4] Copying APK to project root ...
copy /y "%SRC%" "%DEST%" >nul

for %%A in ("%SRC%") do set /a SIZE_MB=%%~zA / 1048576

echo [4/4] Done.
echo.
echo   Build output : %CD%\%SRC%  (%SIZE_MB% MB)
echo   Copied to    : %~dp0%DEST:..\=%
echo.
echo   Install on a USB-connected phone:
echo       adb install -r "%~dp0BianWeiJun-release.apk"
echo.
pause
