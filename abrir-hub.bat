@echo off
setlocal
set "NODE=C:\Users\Wendel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "HUB_DIR=%~dp0"
start "" http://127.0.0.1:8765/
"%NODE%" "%HUB_DIR%server.js"
