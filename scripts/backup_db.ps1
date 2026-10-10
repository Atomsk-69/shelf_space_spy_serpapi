<#
.SYNOPSIS
    Back up the local SQLite database to the gitignored backups/ folder.

.DESCRIPTION
    Uses SQLite's online backup API (through the backend virtualenv) so the copy is
    consistent even while the API is running. Falls back to a plain file copy if the
    virtualenv is missing.

.EXAMPLE
    .\scripts\backup_db.ps1
#>
[CmdletBinding()]
param(
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$database = Join-Path $repoRoot "backend\data\shelf_space_spy.db"
$backupDir = Join-Path $repoRoot "backups"
$python = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $database)) {
    Write-Host "No database found at $database. Nothing to back up." -ForegroundColor Yellow
    exit 0
}

New-Item -ItemType Directory -Force $backupDir | Out-Null
if (-not $Destination) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $Destination = Join-Path $backupDir "shelf_space_spy-$stamp.db"
}

if (Test-Path $python) {
    $code = "import sqlite3, sys; src = sqlite3.connect(sys.argv[1]); dst = sqlite3.connect(sys.argv[2]); src.backup(dst); dst.close(); src.close()"
    & $python -c $code $database $Destination
    if ($LASTEXITCODE -ne 0) { throw "SQLite backup failed." }
} else {
    Copy-Item -LiteralPath $database -Destination $Destination
}

$size = (Get-Item $Destination).Length
Write-Host "Backed up database to $Destination ($size bytes)." -ForegroundColor Green
