<#
.SYNOPSIS
    Start the Shelf Space Spy API (:8000) and UI (:5173) for local development.

.DESCRIPTION
    Before starting, checks whether something is already listening on each port.
    A stale uvicorn/python process on :8000 (or node on :5173) is stopped so we never
    run two API servers against the same SQLite file. Any other process holding a
    port aborts the script so you can decide what to do.

    Each server starts in its own PowerShell window.

.PARAMETER ApiOnly
    Start only the FastAPI backend.

.PARAMETER UiOnly
    Start only the Vite frontend.

.PARAMETER NoReload
    Start uvicorn without --reload (one process instead of reloader + worker).

.EXAMPLE
    .\scripts\dev.ps1
.EXAMPLE
    .\scripts\dev.ps1 -ApiOnly
#>
[CmdletBinding()]
param(
    [switch]$ApiOnly,
    [switch]$UiOnly,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"

function Get-PortOwners([int]$Port) {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) { return @() }
    $ids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($id in $ids) {
        $process = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($process) { $process }
    }
}

function Clear-Port([int]$Port, [string[]]$AllowedNames) {
    $owners = @(Get-PortOwners $Port)
    if ($owners.Count -eq 0) {
        Write-Host "Port $Port is free." -ForegroundColor DarkGray
        return
    }
    foreach ($owner in $owners) {
        if ($AllowedNames -contains $owner.ProcessName.ToLower()) {
            Write-Host "Stopping stale $($owner.ProcessName) (PID $($owner.Id)) on port $Port." -ForegroundColor Yellow
            # uvicorn --reload runs a launcher/reloader parent plus a spawned worker child; stop all of them.
            $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($owner.Id)" -ErrorAction SilentlyContinue
            $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($owner.Id)" -ErrorAction SilentlyContinue
            foreach ($child in $children) {
                if ($AllowedNames -contains ([IO.Path]::GetFileNameWithoutExtension($child.Name)).ToLower()) {
                    Stop-Process -Id $child.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue
                }
            }
            Stop-Process -Id $owner.Id -Force -Confirm:$false -ErrorAction SilentlyContinue
            if ($parent -and $parent.ParentProcessId) {
                $parentProcess = Get-Process -Id $parent.ParentProcessId -ErrorAction SilentlyContinue
                if ($parentProcess -and ($AllowedNames -contains $parentProcess.ProcessName.ToLower())) {
                    Stop-Process -Id $parentProcess.Id -Force -Confirm:$false -ErrorAction SilentlyContinue
                }
            }
        } else {
            throw "Port $Port is used by $($owner.ProcessName) (PID $($owner.Id)). Stop it manually and re-run."
        }
    }
    Start-Sleep -Milliseconds 500
    if (@(Get-PortOwners $Port).Count -gt 0) {
        throw "Port $Port is still busy after stopping stale processes."
    }
}

if (-not $UiOnly) {
    if (-not (Test-Path $python)) {
        throw "backend\.venv is missing. Run 'cd backend; uv sync' first."
    }
    if (-not (Test-Path (Join-Path $backendDir ".env"))) {
        Write-Host "backend\.env is missing; copying .env.example (add your SERPAPI_API_KEY)." -ForegroundColor Yellow
        Copy-Item (Join-Path $backendDir ".env.example") (Join-Path $backendDir ".env")
    }
    Clear-Port 8000 @("python", "pythonw", "uvicorn")
    $reload = if ($NoReload) { "" } else { "--reload" }
    $apiCommand = "Set-Location '$backendDir'; & '$python' -m uvicorn app.main:app $reload --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCommand | Out-Null
    Write-Host "API starting on http://localhost:8000 (docs at /docs)." -ForegroundColor Green
}

if (-not $ApiOnly) {
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        throw "frontend\node_modules is missing. Run 'cd frontend; npm install' first."
    }
    Clear-Port 5173 @("node")
    $uiCommand = "Set-Location '$frontendDir'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $uiCommand | Out-Null
    Write-Host "UI starting on http://localhost:5173." -ForegroundColor Green
}
