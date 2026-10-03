[CmdletBinding()]
param(
    [string]$Version = "0.1.0",
    [string]$Publisher = "Piyush_codex"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frontend = Join-Path $root "frontend"
$release = Join-Path $root "dist\windows-app"
$runtime = Join-Path $release "frontend-runtime"
$node = Join-Path $env:ProgramFiles "nodejs\node.exe"

if (-not (Test-Path -LiteralPath $node)) { throw "Node.js was not found at $node." }

Push-Location $frontend
try {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Dashboard build failed." }
} finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontend ".next\standalone\*") $runtime
New-Item -ItemType Directory -Force -Path (Join-Path $runtime ".next") | Out-Null
Copy-Item -Recurse -Force (Join-Path $frontend ".next\static") (Join-Path $runtime ".next\static")
if (Test-Path (Join-Path $frontend "public")) { Copy-Item -Recurse -Force (Join-Path $frontend "public") (Join-Path $runtime "public") }
Copy-Item -Force $node (Join-Path $release "node.exe")

Push-Location $root
try {
    python -m PyInstaller --noconfirm --clean --windowed --name Recall --icon assets\logo.ico `
      --add-data "$runtime;frontend-runtime" --add-data "$release\node.exe;." `
      --collect-data webview --hidden-import webview.platforms.edgechromium `
      --hidden-import qdrant_client.local.qdrant_local --hidden-import qdrant_client.http.models `
      --exclude-module fastembed --exclude-module torch --exclude-module tensorflow `
      --hidden-import backend.api.server desktop\recall_desktop.py
    if ($LASTEXITCODE -ne 0) { throw "Windows app packaging failed." }
    New-Item -ItemType Directory -Force -Path (Join-Path $root "dist") | Out-Null
    Copy-Item -Recurse -Force (Join-Path $root "dist\Recall") (Join-Path $root "dist\Recall-Windows-$Version")
    Write-Host "Recall Windows app created for $Publisher at dist\Recall-Windows-$Version\Recall.exe"
} finally { Pop-Location }
