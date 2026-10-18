param(
    [switch]$CompileCheck,
    [ValidateSet('once', 'green', 'blue', 'red')]
    [string]$EvidenceLabel = 'once'
)
$ErrorActionPreference = 'Stop'
# Compile production interop/identity guards, but NEVER invoke its Run method.
$text = Get-Content 'D:\Projects\aula\app\native\brightness.ps1' -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value
$type = [AulaBrightnessTransport]
$flags = [Reflection.BindingFlags]'NonPublic,Static'
function Invoke-Guard([string]$Name, [object[]]$Arguments = @()) {
    $method = $type.GetMethod($Name, $flags)
    if (-not $method) { throw "Missing native guard: $Name" }
    for ($i = 0; $i -lt $Arguments.Length; $i++) {
        if ($Arguments[$i] -is [System.Management.Automation.PSObject]) {
            $Arguments[$i] = $Arguments[$i].PSObject.BaseObject
        }
    }
    return $method.Invoke($null, $Arguments)
}
foreach ($name in @('CheckOfficialApp','FindCollection','VerifyCollection','CreateFile','HidD_SetFeature','HidD_GetFeature')) {
    if (-not $type.GetMethod($name,$flags)) { throw "Missing method: $name" }
}
if ($CompileCheck) { 'Compile-only passed; no device access'; exit 0 }
$mutex = New-Object Threading.Mutex($false, 'Global\AulaBrightness_VID258A_PID010C_MI01_COL06')
$owned = $false
$handle = $null
try {
    # Abandoned ownership is an error, not permission to continue.
    $owned = $mutex.WaitOne(0)
    if (-not $owned) { throw 'Another transaction active' }
    if ([IntPtr]::Size -ne 8) { throw 'x64 required' }
    Invoke-Guard 'CheckOfficialApp'
    $path = Invoke-Guard 'FindCollection'
    Invoke-Guard 'CheckOfficialApp'
    $handle = Invoke-Guard 'CreateFile' ([object[]]@($path,[uint32]0,[uint32]3,[IntPtr]::Zero,[uint32]3,[uint32]0,[IntPtr]::Zero))
    if ($handle.IsInvalid) { throw 'Device open failed' }
    Invoke-Guard 'VerifyCollection' ([object[]]@($handle))
    $query = New-Object byte[] 520
    [byte[]]$header = @(6,138,0,0,1,0,0,2)
    [Array]::Copy($header,$query,8)
    Invoke-Guard 'CheckOfficialApp'
    $sent = Invoke-Guard 'HidD_SetFeature' ([object[]]@($handle,$query,[int]520))
    if (-not $sent) { throw 'Palette query send failed; no retry' }
    Start-Sleep -Milliseconds 25
    $response = New-Object byte[] 520
    $response[0] = 6
    Invoke-Guard 'CheckOfficialApp'
    $received = Invoke-Guard 'HidD_GetFeature' ([object[]]@($handle,$response,[int]520))
    $headerMatches = $true
    for($i=0;$i -lt 8;$i++){ if($response[$i] -ne $header[$i]){$headerMatches=$false} }
    [ordered]@{
        time=(Get-Date -Format o); setFeatureCalls=1; getFeatureCalls=1
        query=[int[]]$query; response=[int[]]$response
        apiSuccess=[bool]$received; headerMatches=$headerMatches
        markerMatches=($response[518] -eq 90 -and $response[519] -eq 165)
        actualTransferLengthKnown=$false; note='Single statically recovered8A query; no settings/palette setter, retries or restoration. Wire length must be checked separately.'
    } | ConvertTo-Json -Depth 4 | Set-Content ("D:\Projects\aula\docs\evidence\palette-query-" + $EvidenceLabel + '.json') -Encoding utf8
    if(-not $received -or -not $headerMatches){throw 'Palette response invalid; evidence saved, no retry'}
    'Single query complete; evidence saved. No palette/config setter sent.'
} finally {
    if($handle){$handle.Dispose()}
    if($owned){$mutex.ReleaseMutex()}
    $mutex.Dispose()
}
