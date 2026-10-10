@echo off
title Offline Docs Hub - Tailwind CSS & shadcn/ui
echo Starting Offline Documentation Hub...
cd /d "%~dp0docs-desktop"
bun run tauri dev
pause
