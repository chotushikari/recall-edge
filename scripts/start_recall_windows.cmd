@echo off
setlocal
cd /d "%~dp0.."

where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.11 or newer is required. Install it, then run this launcher again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it, then run this launcher again.
  pause
  exit /b 1
)

if not exist "frontend\node_modules\next" (
  echo Installing dashboard dependencies for the first launch...
  call npm.cmd --prefix frontend install
  if errorlevel 1 (
    echo Dashboard dependency installation failed.
    pause
    exit /b 1
  )
)

python -m uvicorn --version >nul 2>nul
if errorlevel 1 (
  echo Installing the local Recall runtime for the first launch...
  python -m pip install -e .
  if errorlevel 1 (
    echo Runtime installation failed.
    pause
    exit /b 1
  )
)

python scripts\launch_recall_edge.py
