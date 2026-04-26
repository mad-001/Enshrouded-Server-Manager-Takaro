# Install the bridge as a Windows service via NSSM.
# Run from an elevated PowerShell. Requires nssm.exe on PATH (https://nssm.cc/).

param(
    [string]$ServiceName = "EnshroudedBridge",
    [string]$NssmPath = "nssm",
    [string]$BridgeDir = $PSScriptRoot,
    [string]$NodeExe = "node"
)

Write-Host "Installing service: $ServiceName"
Write-Host "  Bridge dir: $BridgeDir"

# Build first
Push-Location $BridgeDir
& $NodeExe (Join-Path $BridgeDir "node_modules\typescript\bin\tsc")
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript build failed"
    exit 1
}
Pop-Location

# Stop & remove if it already exists, then re-install
& $NssmPath stop $ServiceName 2>$null
& $NssmPath remove $ServiceName confirm 2>$null

& $NssmPath install $ServiceName $NodeExe (Join-Path $BridgeDir "dist\index.js")
& $NssmPath set $ServiceName AppDirectory $BridgeDir
& $NssmPath set $ServiceName DisplayName "Enshrouded Takaro Bridge"
& $NssmPath set $ServiceName Description "Tails Enshrouded server log, talks to Takaro WebSocket, manages bans and shutdown."
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppStdout (Join-Path $BridgeDir "logs\service.out.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $BridgeDir "logs\service.err.log")
& $NssmPath set $ServiceName AppStdoutCreationDisposition 4
& $NssmPath set $ServiceName AppStderrCreationDisposition 4

& $NssmPath start $ServiceName
Write-Host "Service installed and started."
