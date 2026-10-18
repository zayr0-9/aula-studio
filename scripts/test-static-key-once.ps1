param([switch]$Execute)
$ErrorActionPreference = 'Stop'
# Research-only single edit: digit1 green -> cyan. No mode/config writes.
# Exact setter06/0180 from owner's vendor capture; getter86 previously observed.
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
        if ($Arguments[$i] -is [System.Management.Automation.PSObject]) { $Arguments[$i] = $Arguments[$i].PSObject.BaseObject }
    }
    return $method.Invoke($null, $Arguments)
}
function Check-Controllers {
    $null = Invoke-Guard 'CheckOfficialApp'
    $apps = @(Get-Process -Name electron,keylux,OpenRGB -ErrorAction SilentlyContinue)
    try { if ($apps.Count) { throw 'Competing controller present' } }
    finally { foreach ($app in $apps) { $app.Dispose() } }
}
function Read-Block($Handle, [byte]$Command, [int]$Length) {
    [byte[]]$header = @(6,$Command,0,0,1,0,($Length -band 255),($Length -shr 8))
    $request = New-Object byte[] 520
    [Array]::Copy($header,$request,8)
    Check-Controllers
    if (-not (Invoke-Guard 'HidD_SetFeature' ([object[]]@($Handle,$request,[int]520)))) { throw 'Query send failed; no retry' }
    Start-Sleep -Milliseconds 25
    $response = New-Object byte[] 520
    $response[0] = 6
    Check-Controllers
    if (-not (Invoke-Guard 'HidD_GetFeature' ([object[]]@($Handle,$response,[int]520)))) { throw 'Query response failed; no retry' }
    for ($i=0; $i -lt 8; $i++) { if ($response[$i] -ne $header[$i]) { throw 'Invalid response header' } }
    for ($i=8+$Length; $i -lt 520; $i++) { if ($response[$i] -ne 0) { throw 'Invalid response padding' } }
    if ($Command -eq 132) {
        if ($response[134] -ne 90 -or $response[135] -ne 165) { throw 'Invalid configuration markers' }
        if ($response[17] -ne 1 -or $response[18] -ne 21 -or $response[67] -ne 64) { throw 'Expected owner-observed custom mode' }
    }
    return ,$response
}
function Assert-Same([byte[]]$Actual, [byte[]]$Expected, [string]$Label) {
    for ($i=8; $i -lt 520; $i++) { if ($Actual[$i] -ne $Expected[$i]) { throw "$Label mismatch at report offset $i; state uncertain; no retry/restoration" } }
}
function With-Digit1Cyan([byte[]]$Fresh) {
    if ($Fresh.Length -ne 520) { throw 'Invalid table length' }
    # All unaddressed data, including unknown payload378..383, preserved verbatim.
    $expected = [byte[]]$Fresh.Clone()
    $expected[15] = 0
    $expected[141] = 255
    $expected[267] = 255
    return ,$expected
}
if ([IntPtr]::Size -ne 8) { throw 'x64 required' }
foreach ($entry in @(@('InterfaceData',32),@('Caps',64),@('ValueCaps',72),@('Attributes',12))) {
    $nested = $type.GetNestedType($entry[0],[Reflection.BindingFlags]::NonPublic)
    if ([Runtime.InteropServices.Marshal]::SizeOf([type]$nested) -ne $entry[1]) { throw 'Unexpected native ABI' }
}
# Synthetic offline preservation check, no fixture replay/device access.
$synthetic = New-Object byte[] 520
for ($i=0; $i -lt 520; $i++) { $synthetic[$i] = [byte]($i % 251) }
$copy = With-Digit1Cyan $synthetic
for ($i=0; $i -lt 520; $i++) { if ($i -notin @(15,141,267) -and $copy[$i] -ne $synthetic[$i]) { throw 'Offline preservation failure' } }
if ($copy[15] -ne 0 -or $copy[141] -ne 255 -or $copy[267] -ne 255) { throw 'Offline target failure' }
if (-not $Execute) { '{"offlineOnly":true,"abiChecked":true,"preservationChecked":true,"target":"Digit1 cyan"}'; exit 0 }
$mutex = New-Object Threading.Mutex($false, 'Global\AulaBrightness_VID258A_PID010C_MI01_COL06')
$owned = $false
$handle = $null
$result = [ordered]@{time=(Get-Date -Format o);target='Digit1 green to cyan';writeAttempted=$false;writeApiSuccess=$false;tableVerified=$false;configurationVerified=$false;actualTransferLengthKnown=$false;noRetry=$true;noRestoration=$true;beforeConfig=$null;beforeTable=$null;afterTable=$null;afterConfig=$null;error=$null}
try {
    $owned = $mutex.WaitOne(0)
    if (-not $owned) { throw 'Another transaction active' }
    Check-Controllers
    $path = Invoke-Guard 'FindCollection'
    Check-Controllers
    $handle = Invoke-Guard 'CreateFile' ([object[]]@($path,[uint32]0,[uint32]3,[IntPtr]::Zero,[uint32]3,[uint32]0,[IntPtr]::Zero))
    if ($handle.IsInvalid) { throw 'Device open failed' }
    Invoke-Guard 'VerifyCollection' ([object[]]@($handle))
    $config = Read-Block $handle 132 128
    $table = Read-Block $handle 134 384
    $result.beforeConfig = [int[]]$config
    $result.beforeTable = [int[]]$table
    # Refuse changed baseline: exact four owner-confirmed keys, other slots black.
    for ($slot=0; $slot -lt 126; $slot++) {
        $rgb = switch ($slot) { 7 { @(0,255,0) } 13 { @(255,0,255) } 19 { @(255,0,0) } 25 { @(0,0,255) } default { @(0,0,0) } }
        for ($channel=0; $channel -lt 3; $channel++) {
            if ($table[8+126*$channel+$slot] -ne $rgb[$channel]) { throw 'Baseline colors changed; no write' }
        }
    }
    $freshConfig = Read-Block $handle 132 128
    Assert-Same $freshConfig $config 'Prewrite configuration'
    $expected = With-Digit1Cyan $table
    $write = [byte[]]$expected.Clone()
    $write[1] = 6
    Check-Controllers
    $result.writeAttempted = $true
    $result.writeApiSuccess = [bool](Invoke-Guard 'HidD_SetFeature' ([object[]]@($handle,$write,[int]520)))
    if (-not $result.writeApiSuccess) { throw 'Static write failed; state uncertain; no retry/restoration' }
    # One setter only. Conservative settle, never repeated static writes/animation.
    Start-Sleep -Milliseconds 500
    $after = Read-Block $handle 134 384
    $result.afterTable = [int[]]$after
    Assert-Same $after $expected 'Full table readback'
    $result.tableVerified = $true
    $afterConfig = Read-Block $handle 132 128
    $result.afterConfig = [int[]]$afterConfig
    Assert-Same $afterConfig $config 'Full configuration readback'
    $result.configurationVerified = $true
} catch {
    $result.error = $_.Exception.GetBaseException().Message
    $result.errorLocation = $_.InvocationInfo.PositionMessage
    $result.errorStack = $_.ScriptStackTrace
}
finally {
    if ($handle) { $handle.Dispose() }
    if ($owned) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
$result | ConvertTo-Json -Compress -Depth 5
if ($result.error) { exit 1 }
