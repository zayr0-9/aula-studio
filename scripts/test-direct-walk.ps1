param([switch]$Execute)
$ErrorActionPreference = 'Stop'
# Fixed240-frame temporary08test,800msminimum; no config/static writes.
$text = Get-Content (Join-Path $PSScriptRoot '../app/native/brightness.ps1') -Raw
$match = [regex]::Match($text,"(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value
$type = [AulaBrightnessTransport]
$flags = [Reflection.BindingFlags]'NonPublic,Static'
function Invoke-Guard([string]$Name,[object[]]$Arguments=@()) {
    $method=$type.GetMethod($Name,$flags)
    if (-not $method) { throw "Missing guard $Name" }
    for($i=0;$i -lt $Arguments.Length;$i++) {
        if($Arguments[$i] -is [System.Management.Automation.PSObject]) { $Arguments[$i]=$Arguments[$i].PSObject.BaseObject }
    }
    return $method.Invoke($null,$Arguments)
}
function Check-Controllers {
    $null=Invoke-Guard 'CheckOfficialApp'
    $apps=@(Get-Process -Name electron,keylux,OpenRGB -ErrorAction SilentlyContinue)
    try { if($apps.Count) { throw 'Competing controller present' } }
    finally { foreach($p in $apps) { $p.Dispose() } }
}
if([IntPtr]::Size -ne 8) { throw 'x64 required' }
foreach($entry in @(@('InterfaceData',32),@('Caps',64),@('ValueCaps',72),@('Attributes',12))) {
    $nested=$type.GetNestedType($entry[0],[Reflection.BindingFlags]::NonPublic)
    if([Runtime.InteropServices.Marshal]::SizeOf([type]$nested) -ne $entry[1]) { throw 'Unexpected ABI' }
}
# Physical left-to-right row order, matches existing offline F75_DIRECT_KEYS map.
$slots=@(0,12,18,24,30,36,42,48,54,60,66,72,78,
1,7,13,19,25,31,37,43,49,55,61,67,73,79,85,
2,8,14,20,26,32,38,44,50,56,62,68,74,80,86,
3,9,15,21,27,33,39,45,51,57,63,69,81,87,
4,10,16,22,28,34,40,46,52,58,64,70,82,88,
5,11,17,35,53,59,77,83,89)
if($slots.Count -ne 80 -or @($slots | Select-Object -Unique).Count -ne 80) { throw 'Invalid map' }
$frames=@()
foreach($channel in @(0,2,1)) {
    foreach($slot in $slots) {
        $frame=New-Object byte[] 520
        [byte[]]$header=@(6,8,0,0,1,0,122,1)
        [Array]::Copy($header,$frame,8)
        $frame[8+3*$slot+$channel]=64
        $frames+=,$frame
    }
}
if($frames.Count -ne 240) { throw 'Invalid frame count' }
foreach($frame in $frames) { if(@($frame | Where-Object { $_ -eq 64 }).Count -ne 1) { throw 'Expected single lit channel' } }
if(-not $Execute) { '{"offlineOnly":true,"keys":80,"frames":240,"intervalMs":800,"sequence":"red blue green","oneKeyAtATime":true}'; exit 0 }
$mutex=New-Object Threading.Mutex($false,'Global\AulaBrightness_VID258A_PID010C_MI01_COL06')
$owned=$false;$handle=$null
$result=[ordered]@{time=(Get-Date -Format o);attempted=0;apiSuccessful=0;intervalMs=800;sendTimesMs=@();configurationBefore=$null;noRetry=$true;noRestoration=$true;error=$null}
try {
    try { $owned=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned=$true;throw 'Interrupted prior transaction; no traffic' }
    if(-not $owned) { throw 'Another transaction active' }
    Check-Controllers
    $path=Invoke-Guard 'FindCollection'
    Check-Controllers
    $handle=Invoke-Guard 'CreateFile' ([object[]]@($path,[uint32]0,[uint32]3,[IntPtr]::Zero,[uint32]3,[uint32]0,[IntPtr]::Zero))
    if($handle.IsInvalid) { throw 'Device open failed' }
    $null=Invoke-Guard 'VerifyCollection' ([object[]]@($handle))
    $config=[byte[]](Invoke-Guard 'IndicatorQuery' ([object[]]@($handle,$true,$true)))
    $result.configurationBefore=[int[]]$config
    # Owner's accepted short test started in ordinary off mode; retain that precondition.
    if($config[17] -ne 0 -or $config[18] -ne 0) { throw 'Expected ordinary off mode; no mode change made' }
    $clock=[Diagnostics.Stopwatch]::StartNew()
    foreach($frame in $frames) {
        if($clock.ElapsedMilliseconds -gt 225000) { throw '225second deadline; no further frame' }
        Check-Controllers
        $result.attempted++
        $result.sendTimesMs+=$clock.ElapsedMilliseconds
        if(-not (Invoke-Guard 'HidD_SetFeature' ([object[]]@($handle,$frame,[int]520)))) { throw 'Direct send failed; uncertain state; no retry' }
        $result.apiSuccessful++
        Start-Sleep -Milliseconds 800
    }
} catch { $result.error=$_.Exception.GetBaseException().Message }
finally {
    if($handle) { $handle.Dispose() }
    if($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
$result | ConvertTo-Json -Compress -Depth 4
if($result.error) { exit 1 }
