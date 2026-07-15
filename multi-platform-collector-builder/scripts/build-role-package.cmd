@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "R1=0"
set "R2=0"
set "R3=0"
set "DISPLAY=hidden"
set "VERSION="

if "%~1"=="" goto :usage

:parseArgs
if "%~1"=="" goto :afterParse
set "ARG=%~1"

if /I "!ARG!"=="hidden" (
  set "DISPLAY=hidden"
  shift
  goto :parseArgs
)

if /I "!ARG!"=="disabled" (
  set "DISPLAY=disabled"
  shift
  goto :parseArgs
)

if /I "!ARG!"=="all" (
  call :addRoleToken "123"
  shift
  goto :parseArgs
)

set "PREFIX=!ARG:~0,8!"
if /I "!PREFIX!"=="version=" (
  set "VERSION=!ARG:~8!"
  shift
  goto :parseArgs
)

call :addRoleToken "!ARG!"
if errorlevel 1 exit /b 1
shift
goto :parseArgs

:afterParse
set "ROLES="
if "!R1!"=="1" set "ROLES=1"
if "!R2!"=="1" (
  if "!ROLES!"=="" (set "ROLES=2") else (set "ROLES=!ROLES!,2")
)
if "!R3!"=="1" (
  if "!ROLES!"=="" (set "ROLES=3") else (set "ROLES=!ROLES!,3")
)

if "!ROLES!"=="" goto :usage
if /I not "!DISPLAY!"=="hidden" if /I not "!DISPLAY!"=="disabled" goto :badDisplay

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%..\"

set "PS1_PATH="
if exist "%SCRIPT_DIR%build-role-package.ps1" set "PS1_PATH=%SCRIPT_DIR%build-role-package.ps1"
if "!PS1_PATH!"=="" if exist "%CD%\scripts\build-role-package.ps1" set "PS1_PATH=%CD%\scripts\build-role-package.ps1"
if "!PS1_PATH!"=="" if exist "%CD%\build-role-package.ps1" set "PS1_PATH=%CD%\build-role-package.ps1"
if "!PS1_PATH!"=="" if exist "%SCRIPT_DIR%..\scripts\build-role-package.ps1" set "PS1_PATH=%SCRIPT_DIR%..\scripts\build-role-package.ps1"
if "!PS1_PATH!"=="" if exist "%SCRIPT_DIR%..\build-role-package.ps1" set "PS1_PATH=%SCRIPT_DIR%..\build-role-package.ps1"

if "!PS1_PATH!"=="" (
  echo.
  echo Build script not found.
  echo Please make sure scripts\build-role-package.ps1 exists.
  echo Current folder: %CD%
  echo Script folder: !SCRIPT_DIR!
  exit /b 1
)

echo.
echo Building role package...
echo Roles: !ROLES!
echo Disabled role display: !DISPLAY!
echo Build script: !PS1_PATH!

if "!VERSION!"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "!PS1_PATH!" -Roles "!ROLES!" -DisabledRoleDisplay "!DISPLAY!"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "!PS1_PATH!" -Roles "!ROLES!" -DisabledRoleDisplay "!DISPLAY!" -Version "!VERSION!"
)

if errorlevel 1 (
  echo.
  echo Build failed. Please check the command and the error above.
  exit /b 1
)

echo.
echo Build completed. Please check the dist folder.
exit /b 0

:addRoleToken
set "TOKEN=%~1"
set "TOKEN=!TOKEN:,=!"
set "TOKEN=!TOKEN:;=!"
set "TOKEN=!TOKEN: =!"
if "!TOKEN!"=="" exit /b 0

:roleCharLoop
if "!TOKEN!"=="" exit /b 0
set "C=!TOKEN:~0,1!"
set "TOKEN=!TOKEN:~1!"
if "!C!"=="1" set "R1=1" & goto :roleCharLoop
if "!C!"=="2" set "R2=1" & goto :roleCharLoop
if "!C!"=="3" set "R3=1" & goto :roleCharLoop
echo.
echo Invalid role: !C!
echo Only 1, 2, 3 are supported.
exit /b 1

:usage
echo.
echo Usage:
echo   build-role-package.cmd 1
echo   build-role-package.cmd 12
echo   build-role-package.cmd 123
echo   build-role-package.cmd 1,2
echo   build-role-package.cmd 1 2
echo   build-role-package.cmd 1,2 disabled
echo   build-role-package.cmd 12 disabled
echo   build-role-package.cmd all
echo.
echo Roles:
echo   1 = customer report
echo   2 = finance withdrawal bill
echo   3 = finance tax bill
echo.
echo Disabled role display:
echo   hidden   default. Hide roles that are not enabled.
echo   disabled show roles that are not enabled, but keep them disabled.
echo.
exit /b 1

:badDisplay
echo.
echo The display option can only be hidden or disabled.
echo Current value: !DISPLAY!
echo.
exit /b 1
