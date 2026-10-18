param([switch]$Execute)
$ErrorActionPreference = 'Stop'
# Research-only getter: Keylux reference/ts-src/device.ts readColorTable and
# protocol.ts READ_COLORS=86, COLOR_LEN=0180; owner-device setter capture confirms
# the same chunk fields and384-byte declaration. Never writes color/config data.
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
function Check-Controllers {
    Invoke-Guard 'CheckOfficialApp'
    $apps = @(Get-Process -Name electron,keylux,OpenRGB -ErrorAction SilentlyContinue)
    try { if ($apps.Count) { throw 'Competing controller present; close before query' } }
    finally { foreach ($app in $apps) { $app.Dispose() } }
}
if ([IntPtr]::Size -ne 8) { throw 'x64 required' }
foreach ($entry in @(@('InterfaceData',32),@('Caps',64),@('ValueCaps',72),@('Attributes',12))) {
    $nested = $type.GetNestedType($entry[0],[Reflection.BindingFlags]::NonPublic)
    if ([Runtime.InteropServices.Marshal]::SizeOf([type]$nested) -ne $entry[1]) { throw 'Unexpected native ABI' }
}
foreach ($name in @('CheckOfficialApp','FindCollection','VerifyCollection','CreateFile','HidD_SetFeature','HidD_GetFeature')) {
    if (-not $type.GetMethod($name,$flags)) { throw "Missing native guard: $name" }
}
[byte[]]$header = @(6,134,0,0,1,0,128,1)
$query = New-Object byte[] 520
[Array]::Copy($header,$query,8)
if (-not $Execute) {
    [ordered]@{offlineOnly=$true;abiChecked=$true;queryHeader=[int[]]$header;settingsWrites=0} | ConvertTo-Json -Compress
    exit 0
}
$mutex = New-Object Threading.Mutex($false, 'Global\AulaBrightness_VID258A_PID010C_MI01_COL06')
$owned = $false
$handle = $null
$result = [ordered]@{time=(Get-Date -Format o);queryAttempted=$false;getAttempted=$false;headerMatches=$false;paddingMatches=$false;actualTransferLengthKnown=$false;settingsWrites=0;noRetry=$true;query=[int[]]$query;response=$null;litSlots=$null;error=$null}
try {
    $owned = $mutex.WaitOne(0)
    if (-not $owned) { throw 'Another transaction active' }
    Check-Controllers
    $path = Invoke-Guard 'FindCollection'
    Check-Controllers
    $handle = Invoke-Guard 'CreateFile' ([object[]]@($path,[uint32]0,[uint32]3,[IntPtr]::Zero,[uint32]3,[uint32]0,[IntPtr]::Zero))
    if ($handle.IsInvalid) { throw 'Device open failed' }
    Invoke-Guard 'VerifyCollection' ([object[]]@($handle))
    Check-Controllers
    $result.queryAttempted = $true
    if (-not (Invoke-Guard 'HidD_SetFeature' ([object[]]@($handle,$query,[int]520)))) { throw 'Getter request failed; no retry' }
    Start-Sleep -Milliseconds 25
    $response = New-Object byte[] 520
    $response[0] = 6
    Check-Controllers
    $result.getAttempted = $true
    $ok = Invoke-Guard 'HidD_GetFeature' ([object[]]@($handle,$response,[int]520))
    $result.response = [int[]]$response
    if (-not $ok) { throw 'Getter response failed; no retry' }
    for ($i=0; $i -lt 8; $i++) { if ($response[$i] -ne $header[$i]) { throw 'Unexpected static response header' } }
    $result.headerMatches = $true
    for ($i=392; $i -lt 520; $i++) { if ($response[$i] -ne 0) { throw 'Unexpected static response padding' } }
    $result.paddingMatches = $true
    # Candidate126-byte planes, established by isolated vendor setter deltas.
    $lit = @()
    for ($slot=0; $slot -lt 126; $slot++) {
        $rgb = @([int]$response[8+$slot],[int]$response[134+$slot],[int]$response[260+$slot])
        if (($rgb[0] -bor $rgb[1] -bor $rgb[2]) -ne 0) { $lit += [ordered]@{slot=$slot;rgb=$rgb} }
    }
    $result.litSlots = $lit
} catch {
    $result.error = $_.Exception.GetBaseException().Message
} finally {
    if ($handle) { $handle.Dispose() }
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
$result | ConvertTo-Json -Compress -Depth 6
if ($result.error) { exit 1 }
