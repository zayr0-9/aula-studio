param([switch]$Execute)
$ErrorActionPreference = 'Stop'
# Default is offline-only. Explicit Execute is for the coordinated one-frame test.
$text = Get-Content (Join-Path $PSScriptRoot '../app/native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value
$type = [AulaBrightnessTransport]
$flags = [Reflection.BindingFlags]'NonPublic,Static'
function Invoke-Guard([string]$Name, [object[]]$Arguments = @()) {
    $method = $type.GetMethod($Name, $flags)
    if (-not $method) { throw "Missing native guard: $Name" }
    for ($i=0; $i -lt $Arguments.Length; $i++) {
        if ($Arguments[$i] -is [System.Management.Automation.PSObject]) {
            $Arguments[$i] = $Arguments[$i].PSObject.BaseObject
        }
    }
    return $method.Invoke($null, $Arguments)
}
# Check production interop ABI without calling Run or any device function.
if ([IntPtr]::Size -ne 8) { throw 'x64 required' }
foreach ($entry in @(@('InterfaceData',32),@('Caps',64),@('ValueCaps',72),@('Attributes',12))) {
    $nested = $type.GetNestedType($entry[0],[Reflection.BindingFlags]::NonPublic)
    if ([Runtime.InteropServices.Marshal]::SizeOf([type]$nested) -ne $entry[1]) { throw 'Unexpected native ABI' }
}
foreach ($name in @('CheckOfficialApp','FindCollection','VerifyCollection','CreateFile','Query','HidD_SetFeature')) {
    if (-not $type.GetMethod($name,$flags)) { throw "Missing native guard: $name" }
}
# Fixed upstream frame, RGB(0,0,16) in the 80 mapped slots only.
$report = New-Object byte[] 520
[byte[]]$header = @(6,8,0,0,1,0,122,1)
[Array]::Copy($header,$report,8)
$gaps = @(6,23,29,41,47,65,71,75,76,84)
for ($slot=0; $slot -lt 90; $slot++) {
    if ($slot -notin $gaps) { $report[8+3*$slot+2] = 16 }
}
if (-not $Execute) {
    [ordered]@{offlineOnly=$true;report=[int[]]$report;abiChecked=$true} | ConvertTo-Json -Compress -Depth 3
    exit 0
}
function Check-Apps {
    Invoke-Guard 'CheckOfficialApp'
    $apps = @(Get-Process -Name electron -ErrorAction SilentlyContinue)
    try { if ($apps.Length -ne 0) { throw 'Electron process present; close Studio before experiment' } }
    finally { foreach ($app in $apps) { $app.Dispose() } }
}
$mutex = New-Object Threading.Mutex($false, 'Global\AulaBrightness_VID258A_PID010C_MI01_COL06')
$owned = $false
$handle = $null
$attempted = $false
$result = [ordered]@{time=(Get-Date -Format o);directAttempted=$false;directApiSuccess=$false;configurationBefore=$null;report=[int[]]$report;noRetry=$true;noRestoration=$true;error=$null}
try {
    # An abandoned mutex throws: never continue with inherited ownership.
    $owned = $mutex.WaitOne(0)
    if (-not $owned) { throw 'Another transaction active' }
    Check-Apps
    $path = Invoke-Guard 'FindCollection'
    Check-Apps
    $handle = Invoke-Guard 'CreateFile' ([object[]]@($path,[uint32]0,[uint32]3,[IntPtr]::Zero,[uint32]3,[uint32]0,[IntPtr]::Zero))
    if ($handle.IsInvalid) { throw 'Device open failed' }
    Invoke-Guard 'VerifyCollection' ([object[]]@($handle))
    # Fresh baseline using production header/padding/marker/custom checks.
    $fresh = [byte[]](Invoke-Guard 'Query' ([object[]]@($handle)))
    $result.configurationBefore = [int[]]$fresh
    Check-Apps
    $attempted = $true
    $result.directAttempted = $true
    $result.directApiSuccess = [bool](Invoke-Guard 'HidD_SetFeature' ([object[]]@($handle,$report,[int]520)))
    if (-not $result.directApiSuccess) { throw 'Direct send failed; state uncertain; no retry' }
    # No readback/query/refresh after direct frame; observe reversion without traffic.
} catch {
    $result.error = if ($attempted) { 'Experiment failed after direct attempt; state uncertain. No retry.' } else { 'Preflight/baseline failed before direct attempt.' }
    $result.errorDetail = $_.Exception.GetBaseException().Message
} finally {
    if ($handle) { $handle.Dispose() }
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
$result | ConvertTo-Json -Compress -Depth 4
if ($result.error) { exit 1 }
