# Hardware-free: compile extracted C# and invoke only its pure clone helper.
$ErrorActionPreference = 'Stop'
$text = Get-Content (Join-Path $PSScriptRoot '../app/native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native C# source not found.' }
Add-Type -TypeDefinition $match.Groups[1].Value -ErrorAction Stop
$helper = [AulaBrightnessTransport].GetMethod('WithPgUp', [Reflection.BindingFlags]'NonPublic,Static')
if ($null -eq $helper) { throw 'WithPgUp helper not found.' }
function Invoke-Clone([byte[]]$Buffer, [int]$Usage) {
    $arguments = New-Object object[] 2
    $arguments[0] = $Buffer
    $arguments[1] = $Usage
    return ,([byte[]]$helper.Invoke($null, $arguments))
}
function Assert-Same([byte[]]$Actual, [byte[]]$Expected, [string]$Context) {
    if ($Actual.Length -ne $Expected.Length) { throw "$Context length mismatch" }
    for ($i = 0; $i -lt $Actual.Length; $i++) {
        if ($Actual[$i] -ne $Expected[$i]) { throw "$Context byte $i mismatch" }
    }
}
function Assert-Rejected([byte[]]$Buffer, [int]$Usage, [string]$Context) {
    $before = if ($null -ne $Buffer) { [byte[]]$Buffer.Clone() } else { $null }
    $rejected = $false
    try { $null = Invoke-Clone $Buffer $Usage } catch {
        $base = $_.Exception.GetBaseException()
        if ($base -isnot [ArgumentException] -and $base -isnot [InvalidOperationException]) { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw "Accepted invalid $Context" }
    if ($null -ne $Buffer) { Assert-Same $Buffer $before "$Context input immutability" }
}
# Captured fresh command83 layer0 response, not a synthesized setter payload.
# Offline fixture only: never replay to hardware.
[byte[]]$fixture = @(6,131,0,0,1,0,0,2,0,0,0,41,0,0,0,53,0,0,0,43,0,0,0,57,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,30,0,0,0,20,0,0,0,4,0,0,0,29,0,8,0,0,0,0,0,58,0,0,0,31,0,0,0,26,0,0,0,22,0,0,0,27,0,4,0,0,0,0,0,59,0,0,0,32,0,0,0,8,0,0,0,7,0,0,0,6,0,0,0,0,0,0,0,60,0,0,0,33,0,0,0,21,0,0,0,9,0,0,0,25,0,0,0,0,0,0,0,61,0,0,0,34,0,0,0,23,0,0,0,10,0,0,0,5,0,0,0,44,0,0,0,62,0,0,0,35,0,0,0,28,0,0,0,11,0,0,0,17,0,0,0,0,0,0,0,63,0,0,0,36,0,0,0,24,0,0,0,13,0,0,0,16,0,0,0,0,0,0,0,64,0,0,0,37,0,0,0,12,0,0,0,14,0,0,0,54,13,0,0,0,0,0,0,65,0,0,0,38,0,0,0,18,0,0,0,15,0,0,0,55,0,16,0,0,0,0,0,66,0,0,0,39,0,0,0,19,0,0,0,51,0,0,0,56,0,0,0,0,0,0,0,67,0,0,0,45,0,0,0,47,0,0,0,52,0,32,0,0,0,0,0,0,0,0,0,68,0,0,0,46,0,0,0,48,0,0,0,0,0,0,0,0,0,0,0,80,0,0,0,69,0,0,0,42,0,0,0,49,0,0,0,40,0,0,0,82,0,0,0,81,7,0,0,29,0,0,0,76,0,0,0,75,0,0,0,78,0,0,0,77,0,0,0,79,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,90,165)
# Load canonical evidence instead of relying on hand-copied byte arrays.
[byte[]]$fixture = (Get-Content (Join-Path $PSScriptRoot '../docs/evidence/matrix-layer0-20261017-231730.json') -Raw | ConvertFrom-Json).response
if ($fixture.Length -ne 520 -or $fixture[1] -ne 131 -or $fixture[355] -ne 75) { throw 'Invalid captured fixture.' }
foreach ($sourceUsage in @(74, 75)) {
    [byte[]]$fresh = $fixture.Clone()
    $fresh[355] = $sourceUsage
    foreach ($target in @(74, 75)) {
        [byte[]]$before = $fresh.Clone()
        [byte[]]$actual = Invoke-Clone $fresh $target
        if ([object]::ReferenceEquals($fresh, $actual)) { throw 'Helper returned input instead of clone.' }
        [byte[]]$expected = $fresh.Clone()
        $expected[355] = $target
        Assert-Same $actual $expected "source $sourceUsage target $target entire report"
        Assert-Same $fresh $before 'input immutability'
    }
}
foreach ($offset in (@(0..7) + @(352, 353, 354, 516, 517, 518, 519))) {
    [byte[]]$bad = $fixture.Clone()
    $bad[$offset] = $bad[$offset] -bxor 1
    Assert-Rejected $bad 74 "report offset $offset"
}
foreach ($sourceUsage in @(0, 1, 73, 76, 255)) {
    [byte[]]$bad = $fixture.Clone(); $bad[355] = $sourceUsage
    Assert-Rejected $bad 74 "source usage $sourceUsage"
}
foreach ($length in @(0, 1, 8, 352, 355, 356, 519, 521)) {
    [byte[]]$bad = New-Object byte[] $length
    [Array]::Copy($fixture, $bad, [Math]::Min($length, $fixture.Length))
    Assert-Rejected $bad 74 "length $length"
}
Assert-Rejected $null 74 'null buffer'
foreach ($usage in @([int]::MinValue, -1, 0, 73, 76, 255, 256, [int]::MaxValue)) {
    Assert-Rejected $fixture $usage "target bounds $usage"
}
if ([AulaBrightnessTransport]::ConfigurationWriteAttempted) { throw 'Unexpected write flag.' }
'Native matrix offline tests passed; no hardware I/O.'
