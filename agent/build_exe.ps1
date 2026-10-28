# Build a single-file spillguard.exe that bundles the AetherOS build (dist/) and the fit calibration.
# Run from the repo root after `npm run build`:   powershell -File agent\build_exe.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '.')
if (-not (Test-Path ..\dist\index.html)) { throw 'Run `npm run build` in the repo root first.' }
.venv\Scripts\python -m pip install -q pyinstaller
.venv\Scripts\python -m PyInstaller --noconfirm --onefile --name spillguard `
  --distpath build\exe --workpath build\work --specpath build `
  --add-data "..\..\dist;dist" --add-data "..\calibration.json;." `
  --collect-submodules uvicorn --collect-submodules websockets --hidden-import win32pdh `
  spillguard_entry.py
Write-Host "Built $(Resolve-Path build\exe\spillguard.exe). Run: spillguard.exe serve"
