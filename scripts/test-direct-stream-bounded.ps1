param([switch]$Execute)
$ErrorActionPreference = 'Stop'
# Fixed research test: six command08 frames at >=800ms, digits1–4 only.
# No configuration writes, static06 writes, retries or restoration.
$text = Get-Content (Join-Path $PSScriptRoot '../app/native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value
$type = [AulaBrightnessTransport]
$flags = [Reflection.BindingFlags]'NonPublic,Static'
function Invoke-Guard([string]$Name, [object[]]$Arguments = @()) {
    $method = $type.GetMethod($Name,$flags)
    if (-not $method) { throw "Missing native guard: $Name" }
    for ($i=0; $i -lt $Arguments.Length; $i++) {
        if ($Arguments[$i] -is [System.Management.Automation.PSObject]) { $Arguments[$i] = $Arguments[$i].PSObject.BaseObject }
    }
    return $method.Invoke($null,$Arguments)
}
function Check-Controllers {
    $null = Invoke-Guard 'CheckOfficialApp'
    $apps = @(Get-Process -Name electron,keylux,OpenRGB -ErrorAction SilentlyContinue)
    try { if ($apps.Count) { throw 'Competing controller present' } }
    finally { foreach ($app in $apps) { $app.Dispose() } }
}
if ([IntPtr]::Size -ne 8) { throw 'x64 required' }
foreach ($entry in @(@('InterfaceData',32),@('Caps',64),@('ValueCaps',72),@('Attributes',12))) {
    $nested = $type.GetNestedType($entry[0],[Reflection.BindingFlags]::NonPublic)
    if ([Runtime.InteropServices.Marshal]::SizeOf([type]$nested) -ne $entry[1]) { throw 'Unexpected native ABI' }
}
$frames = @()
foreach ($channel in @(0,2,1,0,2,1)) {
    $frame = New-Object byte[] 520
    [byte[]]$header = @(6,8,0,0,1,0,122,1)
    [Array]::Copy($header,$frame,8)
    foreach ($slot in @(7,13,19,25)) { $frame[8+3*$slot+$channel] = 64 }
    $frames += ,$frame
}
foreach ($frame in $frames) {
    if ($frame.Length -ne 520 -or @($frame | Where-Object { $_ -eq 64 }).Count -ne 4) { throw 'Offline frame assertion failed' }
}
if (-not $Execute) { '{"offlineOnly":true,"frames":6,"intervalMs":800,"keys":"Digit1-4","sequence":"red blue green red blue green","settingsWrites":0}'; exit 0 }
$mutex = New-Object Threading.Mutex($false,'Global\AulaBrightness_VID258A_PID010C_MI01_COL06')
$owned = $false
$handle = $null
$result = [ordered]@{time=(Get-Date -Format o);intervalMs=800;plannedFrames=6;attempted=0;apiSuccessful=0;sendTimesMs=@();configurationBefore=$null;noRetry=$true;noRestoration=$true;directReadbackAvailable=$false;error=$null}
try {
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned=$true; throw 'Interrupted previous transaction; no traffic' }
    if (-not $owned) { throw 'Another transaction active' }
    Check-Controllers
    $path = Invoke-Guard 'FindCollection'
    Check-Controllers
    $handle = Invoke-Guard 'CreateFile' ([object[]]@($path,[uint32]0,[uint32]3,[IntPtr]::Zero,[uint32]3,[uint32]0,[IntPtr]::Zero))
    if ($handle.IsInvalid) { throw 'Device open failed' }
    $null = Invoke-Guard 'VerifyCollection' ([object[]]@($handle))
    # Validated ordinary or exact observed custom mode; no mode transition.
    $fresh = [byte[]](Invoke-Guard 'IndicatorQuery' ([object[]]@($handle,$true,$true)))
    $result.configurationBefore = [int[]]$fresh
    $clock = [Diagnostics.Stopwatch]::StartNew()
    foreach ($frame in $frames) {
        if ($clock.ElapsedMilliseconds -gt 6500) { throw 'Session deadline exceeded; no further frame' }
        Check-Controllers
        $result.attempted++
        $result.sendTimesMs += $clock.ElapsedMilliseconds
        if (-not (Invoke-Guard 'HidD_SetFeature' ([object[]]@($handle,$frame,[int]520)))) { throw 'Direct send failed; state uncertain; no retry' }
        $result.apiSuccessful++
        Start-Sleep -Milliseconds 800
    }
    # No post-stream queries/restore: observe firmware timeout without traffic.
} catch { $result.error = $_.Exception.GetBaseException().Message }
finally {
    if ($handle) { $handle.Dispose() }
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
$result | ConvertTo-Json -Compress -Depth 4
if ($result.error) { exit 1 }
