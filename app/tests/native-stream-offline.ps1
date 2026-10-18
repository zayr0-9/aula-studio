# Pure production codec/reader tests only: never call Run or any HID method.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../native/stream-session.ps1') -CompileCheck
function Assert([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Reject([scriptblock]$Body) {
    $rejected = $false
    try { $null = & $Body } catch { $rejected = $true }
    Assert $rejected 'Expected rejection'
}
$colors = @(); for ($i = 0; $i -lt 90; $i++) { $colors += ,@(255,128,1) }
$line = @{colors=$colors} | ConvertTo-Json -Depth 4 -Compress
$report = [AulaStreamSession]::Encode($line)
Assert ($report.Length -eq 520) 'Report length'
Assert (([int[]]$report[0..7] -join ',') -eq '6,8,0,0,1,0,122,1') 'Fixed command08/378 header'
$slots = @(0,12,18,24,30,36,42,48,54,60,66,72,78,
1,7,13,19,25,31,37,43,49,55,61,67,73,79,85,
2,8,14,20,26,32,38,44,50,56,62,68,74,80,86,
3,9,15,21,27,33,39,45,51,57,63,69,81,87,
4,10,16,22,28,34,40,46,52,58,64,70,82,88,
5,11,17,35,53,59,77,83,89)
Assert ($slots.Count -eq 80) 'Map count'
for ($i = 0; $i -lt 90; $i++) {
    $expected = if ($slots -contains $i) { '255,128,1' } else { '0,0,0' }
    Assert (([int[]]$report[(8+3*$i)..(10+3*$i)] -join ',') -eq $expected) "Slot $i"
}
for ($i = 278; $i -lt 520; $i++) { Assert ($report[$i] -eq 0) 'Zero remaining payload and padding' }
Assert ($null -eq [AulaStreamSession]::Encode('{"stop":true}')) 'Stop'
foreach ($bad in @('', '{}', '[]', '{"stop":false}', '{"stop":1}', '{"stop":true,"colors":[]}', '{"colors":[]}', (' ' * 8193))) {
    Reject { [AulaStreamSession]::Encode($bad) }
}
foreach ($badValue in @(-1,256,1.5,'2',$true,$null)) {
    $colors[0][0] = $badValue
    $badLine = @{colors=$colors} | ConvertTo-Json -Depth 4 -Compress
    Reject { [AulaStreamSession]::Encode($badLine) }
}
$cfg = New-Object byte[] 520
[AulaStreamSession]::RequireOff($cfg)
$cfg[17]=1; Reject { [AulaStreamSession]::RequireOff($cfg) }
$cfg[17]=0; $cfg[18]=1; Reject { [AulaStreamSession]::RequireOff($cfg) }
Reject { [AulaStreamSession]::RequireOff((New-Object byte[] 136)) }
Assert ([AulaStreamSession]::ReadBoundedLine([IO.StringReader]::new("{}`r`n")) -eq '{}') 'CRLF'
Assert ($null -eq [AulaStreamSession]::ReadBoundedLine([IO.StringReader]::new(''))) 'EOF'
Assert ([AulaStreamSession]::ReadBoundedLine([IO.StringReader]::new(('x' * 8192) + "`n")).Length -eq 8192) 'Line limit'
Reject { [AulaStreamSession]::ReadBoundedLine([IO.StringReader]::new(('x' * 8193) + "`n")) }
Reject { [AulaStreamSession]::ReadBoundedLine([IO.StringReader]::new('{}')) }
Assert ([AulaStreamSession]::IntervalMs -eq 800 -and [AulaStreamSession]::LeaseMs -eq 2500 -and [AulaStreamSession]::MaxSessionMs -eq 1800000) 'Safety bounds'
'{"offlineOnly":true,"passed":true}'
