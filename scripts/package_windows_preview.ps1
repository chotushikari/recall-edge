[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\dist")
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$archivePath = Join-Path $outputPath "Recall-Desktop-Preview.zip"
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

Push-Location $repoRoot
try {
    git archive --format=zip --prefix="Recall-Desktop-Preview/" --output=$archivePath HEAD
    if ($LASTEXITCODE -ne 0) {
        throw "git archive could not create the Windows preview bundle."
    }
} finally {
    Pop-Location
}

Write-Host "Created $archivePath"
Write-Host "Extract the archive and run scripts\start_recall_windows.cmd."
