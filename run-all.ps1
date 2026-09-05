[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipDocker,
    [switch]$SkipMigrations,
    [switch]$CheckOnly,
    [switch]$OpenBrowser,
    [switch]$StopDatabaseOnExit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$BackendRoot = Join-Path $RepoRoot "backend"
$FrontendRoot = Join-Path $RepoRoot "frontend"
$PythonPath = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$BackendEnv = Join-Path $BackendRoot ".env"
$FrontendEnv = Join-Path $FrontendRoot ".env.local"
$BackendProcess = $null
$FrontendProcess = $null

function Assert-CommandSucceeded {
    param([Parameter(Mandatory)][string]$Action)

    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

function Stop-ProcessTree {
    param([System.Diagnostics.Process]$Process)

    if ($null -eq $Process) {
        return
    }
    try {
        $Process.Refresh()
        if (-not $Process.HasExited) {
            & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
        }
    }
    catch {
        Write-Warning "Could not stop process $($Process.Id): $($_.Exception.Message)"
    }
}

Push-Location $RepoRoot
try {
    if (-not (Test-Path -LiteralPath $BackendEnv)) {
        Copy-Item -LiteralPath (Join-Path $BackendRoot ".env.example") -Destination $BackendEnv
        Write-Host "Created backend/.env from the local example." -ForegroundColor Yellow
    }
    if (-not (Test-Path -LiteralPath $FrontendEnv)) {
        Copy-Item -LiteralPath (Join-Path $FrontendRoot ".env.example") -Destination $FrontendEnv
        Write-Host "Created frontend/.env.local from the local example." -ForegroundColor Yellow
    }

    if ($Install) {
        if (-not (Test-Path -LiteralPath $PythonPath)) {
            $SystemPython = Get-Command python -ErrorAction Stop
            & $SystemPython.Source -m venv (Join-Path $RepoRoot ".venv")
            Assert-CommandSucceeded "Virtual environment creation"
        }
        & $PythonPath -m pip install -e "$BackendRoot[dev]"
        Assert-CommandSucceeded "Backend dependency installation"
        & npm.cmd --prefix $FrontendRoot ci
        Assert-CommandSucceeded "Frontend dependency installation"
    }

    if (-not (Test-Path -LiteralPath $PythonPath)) {
        throw "Missing .venv. Run .\run-all.ps1 -Install once."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $FrontendRoot "node_modules"))) {
        throw "Missing frontend/node_modules. Run .\run-all.ps1 -Install once."
    }
    Get-Command npm.cmd -ErrorAction Stop | Out-Null

    if ($CheckOnly) {
        Write-Host "Checking backend configuration..." -ForegroundColor Cyan
        & $PythonPath (Join-Path $BackendRoot "manage.py") check
        Assert-CommandSucceeded "Backend configuration check"
        Write-Host "Checking frontend types..." -ForegroundColor Cyan
        & npm.cmd --prefix $FrontendRoot run typecheck
        Assert-CommandSucceeded "Frontend type check"
        Write-Host "Launcher prerequisites are ready." -ForegroundColor Green
        return
    }

    if (-not $SkipDocker) {
        Get-Command docker -ErrorAction Stop | Out-Null
        Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
        & docker compose up -d --wait --wait-timeout 60 db
        Assert-CommandSucceeded "PostgreSQL startup"
    }

    if (-not $SkipMigrations) {
        Write-Host "Applying database migrations..." -ForegroundColor Cyan
        & $PythonPath (Join-Path $BackendRoot "manage.py") migrate --noinput
        Assert-CommandSucceeded "Database migration"
    }

    Write-Host "Starting Django on http://127.0.0.1:8000" -ForegroundColor Green
    $BackendProcess = Start-Process `
        -FilePath $PythonPath `
        -ArgumentList @("manage.py", "runserver", "127.0.0.1:8000", "--noreload") `
        -WorkingDirectory $BackendRoot `
        -NoNewWindow `
        -PassThru

    Write-Host "Starting Next.js on http://localhost:3000" -ForegroundColor Green
    $FrontendProcess = Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList @("run", "dev") `
        -WorkingDirectory $FrontendRoot `
        -NoNewWindow `
        -PassThru

    if ($OpenBrowser) {
        Start-Process "http://localhost:3000"
    }

    Write-Host "Both services are running. Press Ctrl+C to stop them." -ForegroundColor Cyan
    while ($true) {
        Start-Sleep -Milliseconds 500
        $BackendProcess.Refresh()
        $FrontendProcess.Refresh()
        if ($BackendProcess.HasExited) {
            throw "Django stopped with exit code $($BackendProcess.ExitCode)."
        }
        if ($FrontendProcess.HasExited) {
            throw "Next.js stopped with exit code $($FrontendProcess.ExitCode)."
        }
    }
}
finally {
    if ($null -ne $FrontendProcess -or $null -ne $BackendProcess) {
        Write-Host "Stopping application services..." -ForegroundColor Yellow
    }
    Stop-ProcessTree $FrontendProcess
    Stop-ProcessTree $BackendProcess
    if ($StopDatabaseOnExit -and -not $SkipDocker -and -not $CheckOnly) {
        & docker compose stop db
    }
    Pop-Location
}
