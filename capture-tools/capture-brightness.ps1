param(
    [string]$CaptureAction = 'Owner brightness9->8->9 only',
    [string]$Baseline = 'Neon_stream brightness9 speed4 Colourful enabled'
)
$ErrorActionPreference = 'Stop'
$root = 'D:\Projects\aula\capture-tools'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$prefix = Join-Path $root ('brightness-' + $stamp)
$status = Join-Path $root 'capture-status.json'
$p = $null
$deadline = $null
. (Join-Path $PSScriptRoot 'process-deadline.ps1')
try {
    $identity = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Capture supervisor must already be elevated; no automatic elevation.' }
    if (Get-Process USBPcapCMD -ErrorAction SilentlyContinue) { throw 'Another USB capture is already active.' }
    $exe = 'C:\Program Files\USBPcap\USBPcapCMD.exe'
    $devices = (& $exe --extcap-interface '\\.\USBPcap3' --extcap-config 2>&1 | Out-String)
    if ($devices -notmatch 'value=2\}\{display=\[2\] USB Composite Device') { throw 'Expected device mapping missing; capture not started.' }
    $target = @(Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'USB\VID_258A&PID_010C\*' })
    if ($target.Count -ne 1) { throw 'Expected one matching wired F75; capture not started.' }
    $paths = (Get-PnpDeviceProperty -InstanceId $target[0].InstanceId -KeyName DEVPKEY_Device_LocationPaths).Data
    if ($paths -notcontains 'PCIROOT(0)#PCI(0803)#PCI(0000)#USBROOT(0)#USB(1)#USB(2)') { throw 'Keyboard location changed; capture not started.' }
    $args = '-d \\.\USBPcap3 --devices 2 -s 65535 -b 1048576 -o "' + $prefix + '.pcap"'
    $p = Start-Process $exe -ArgumentList $args -PassThru -RedirectStandardOutput ($prefix + '.stdout.txt') -RedirectStandardError ($prefix + '.stderr.txt') -WindowStyle Hidden
    $deadline = [AulaCaptureDeadline]::new($p, 120000)
    Start-Sleep -Seconds 2
    if ($p.HasExited) { throw ('Capture exited early: ' + $p.ExitCode) }
    $started = Get-Date
    $elapsed = [Diagnostics.Stopwatch]::StartNew()
    @{ state='recording'; started=$started.ToString('o'); maxSeconds=120; pid=$p.Id; file=($prefix+'.pcap'); interface='USBPcap3'; deviceAddress=2; baseline=$Baseline; action=$CaptureAction } | ConvertTo-Json | Set-Content $status -Encoding utf8
    while ($elapsed.Elapsed.TotalSeconds -lt 118 -and -not $p.HasExited) {
        if ((Test-Path ($prefix+'.pcap')) -and (Get-Item ($prefix+'.pcap')).Length -gt 16777216) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $p.HasExited) { $p.Kill(); if (-not $p.WaitForExit(3000)) { throw 'Capture exit not confirmed' } }
    if ($deadline.Failure) { throw ('Deadline watchdog: ' + $deadline.Failure) }
    @{ state='stopped'; stopped=(Get-Date).ToString('o'); file=($prefix+'.pcap'); note='Bounded capture process terminated; validate pcap integrity before analysis.' } | ConvertTo-Json | Set-Content $status -Encoding utf8
} catch {
    if ($p -and -not $p.HasExited) { try { $p.Kill(); $null = $p.WaitForExit(3000) } catch { Write-Warning 'Capture cleanup failed; verify capture process manually.' } }
    @{state='error'; error=$_.Exception.Message; file=($prefix+'.pcap')} | ConvertTo-Json | Set-Content $status -Encoding utf8
    exit 1
}
finally {
    if ($deadline) { $deadline.Dispose() }
    if ($p -and $p.HasExited) { $p.Dispose() }
}
