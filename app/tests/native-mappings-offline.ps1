# Pure production codecs only; no Run*, enumeration, queries or device access.
$ErrorActionPreference = 'Stop'
$text = Get-Content (Join-Path $PSScriptRoot '../native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value
$flags = [Reflection.BindingFlags]'NonPublic,Static'
$type = [AulaBrightnessTransport]
$with = $type.GetMethod('WithMapping', $flags)
$read = $type.GetMethod('MappingsJson', $flags)
$ids = $type.GetField('MappingIds', $flags).GetValue($null)
$slots = $type.GetField('MappingSlots', $flags).GetValue($null)
$usages = $type.GetField('MappingUsages', $flags).GetValue($null)
$data = Get-Content (Join-Path $PSScriptRoot '../../docs/evidence/matrix-layer0-20261018-103210.json') -Raw | ConvertFrom-Json
$fresh = [byte[]]$data.response
if ($slots.Length -ne 79 -or $ids.Length -ne 81) { throw 'Wrong catalog count' }
$assignments = $read.Invoke($null, [object[]]@(,$fresh)) | ConvertFrom-Json
if ($assignments.Count -ne 79) { throw 'Wrong assignments count' }
$modifierMasks = @{ ControlLeft=1; ShiftLeft=2; MetaLeft=8; AltLeft=4; ControlRight=16; ShiftRight=32 }
# Independently verify standalone defaults in canonical matrix, rather than synthetic data.
foreach ($pair in @(@(4,2), @(5,1), @(11,8), @(17,4), @(59,16), @(70,32))) {
    $offset = 8 + 4 * $pair[0]
    if (($fresh[$offset..($offset+3)] -join ',') -ne "0,$($pair[1]),0,0") { throw 'Modifier default mismatch' }
}
$targets = @()
for ($i = 0; $i -lt $ids.Length; $i++) {
    if ($usages[$i] -eq 0) { $targets += ,@($ids[$i], $modifierMasks[$ids[$i]], 0); continue }
    foreach ($mask in 0..3) {
        $prefix = @('', 'Ctrl+', 'Shift+', 'Ctrl+Shift+')[$mask]
        $targets += ,@("$prefix$($ids[$i])", $mask, $usages[$i])
    }
}
$count = 0
for ($s = 0; $s -lt $slots.Length; $s++) {
    $offset = 8 + 4 * $slots[$s]
    if ($assignments[$s].target -ne $ids[$s]) { throw "Canonical mismatch $s" }
    foreach ($target in $targets) {
        $result = [byte[]]$with.Invoke($null, [object[]]@($fresh, $ids[$s], $target[0]))
        $entry = @(0, $target[1], 0, $target[2])
        for ($i = 0; $i -lt 520; $i++) {
            $expected = if ($i -ge $offset -and $i -lt $offset+4) { $entry[$i-$offset] } else { $fresh[$i] }
            if ($result[$i] -ne $expected) { throw "Preservation failure $s $($target[0]) $i" }
        }
        $observed = $read.Invoke($null, [object[]]@(,$result)) | ConvertFrom-Json
        if ($observed[$s].target -cne $target[0]) { throw 'Roundtrip mismatch' }
        # Rewriting a supported shortcut must clear mask/usage correctly.
        $restored = [byte[]]$with.Invoke($null, [object[]]@($result, $ids[$s], $ids[$s]))
        if ([Convert]::ToBase64String($restored) -ne [Convert]::ToBase64String($fresh)) { throw 'Restoration/input mutation failure' }
        $count++
    }
    foreach ($entry in @(@(1,0,0,6), @(0,4,0,6), @(0,8,0,6), @(0,16,0,6), @(0,32,0,6), @(0,64,0,6), @(0,128,0,6), @(0,255,0,6), @(0,0,1,6), @(0,0,0,255), @(0,0,0,0), @(0,3,0,0))) {
        $special = [byte[]]$fresh.Clone()
        for ($i = 0; $i -lt 4; $i++) { $special[$offset+$i] = $entry[$i] }
        $rejected = $false
        try { $null = $with.Invoke($null, [object[]]@($special, $ids[$s], 'Home')) } catch { $rejected = $true }
        if (-not $rejected) { throw 'Unsupported source accepted' }
        $observed = $read.Invoke($null, [object[]]@(,$special)) | ConvertFrom-Json
        if ($null -ne $observed[$s].target) { throw 'Unsupported entry not null' }
    }
}
foreach ($source in @('Fn', 'AltRight', 'MetaRight', 'Knob', 'Home', 'Insert', 'bogus')) {
    $rejected = $false
    try { $null = $with.Invoke($null, [object[]]@($fresh, $source, 'Home')) } catch { $rejected = $true }
    if (-not $rejected) { throw 'Forbidden source accepted' }
}
foreach ($target in @('Ctrl+', 'Ctrl+Shift+', 'Ctrl+ControlLeft', 'Shift+ShiftLeft', 'Shift+Ctrl+KeyC', 'Ctrl+Ctrl+KeyC', 'ctrl+KeyC', 'Alt+KeyC', 'Ctrl+MetaLeft', 'Shift+AltLeft', 'Ctrl+ControlRight', 'Shift+ShiftRight', 'Fn', 'AltRight', 'MetaRight')) {
    $rejected = $false
    try { $null = $with.Invoke($null, [object[]]@($fresh, 'Digit1', $target)) } catch { $rejected = $true }
    if (-not $rejected) { throw 'Forbidden target accepted' }
}
foreach ($index in @(0,1,2,3,4,5,6,7,516,517,518,519)) {
    $bad = [byte[]]$fresh.Clone(); $bad[$index] = $bad[$index] -bxor 1
    $rejected = $false
    try { $null = $read.Invoke($null, [object[]]@(,$bad)) } catch { $rejected = $true }
    if (-not $rejected) { throw 'Bad header/signature accepted' }
}
$evidence = Get-Content (Join-Path $PSScriptRoot '../../docs/evidence/modifier-shortcut-capture.json') -Raw | ConvertFrom-Json
foreach ($case in @(@(0,'ControlLeft'), @(1,'Ctrl+KeyC'), @(2,'Ctrl+Shift+KeyC'), @(3,'Digit1'))) {
    $encoded = [byte[]]$with.Invoke($null, [object[]]@($fresh, 'Digit1', $case[1]))
    if (($encoded[36..39] -join ',') -ne ($evidence.writes[$case[0]].entry7 -join ',')) { throw 'Capture encoding mismatch' }
}
$remaining = Get-Content (Join-Path $PSScriptRoot '../../docs/evidence/remaining-modifiers-fn-capture.json') -Raw | ConvertFrom-Json
foreach ($write in $remaining.modifierCapture.writes) {
    $encoded = [byte[]]$with.Invoke($null, [object[]]@($fresh, 'Digit1', $write.target))
    $offset = 8 + 4 * $write.slot
    if (($encoded[$offset..($offset+3)] -join ',') -ne ($write.entry -join ',')) { throw "Standalone capture mismatch frame $($write.frame)" }
    $differences = @(for ($i = 8; $i -lt 520; $i++) { if ($encoded[$i] -ne $fresh[$i]) { $i } })
    if (($differences -join ',') -ne '37,39') { throw 'Standalone capture isolation mismatch' }
}
# Every mask: only six exact standalone masks and ordinary shortcut masks0..3 are accepted.
foreach ($mask in 0..255) {
    foreach ($usage in @(0,6)) {
        $candidate = [byte[]]$fresh.Clone()
        $candidate[37] = $mask; $candidate[39] = $usage
        $observed = $read.Invoke($null, [object[]]@(,$candidate)) | ConvertFrom-Json
        $supported = if ($usage -eq 0) { @($modifierMasks.Values) -contains $mask } else { $mask -le 3 }
        if (($null -ne ($observed | Where-Object source -eq 'Digit1').target) -ne $supported) { throw "Mask acceptance mismatch $mask/$usage" }
    }
}
# Captured Fn type13 remains an unsupported source entry and cannot be overwritten.
$fn = [byte[]]$fresh.Clone(); $fn[36] = 13; $fn[39] = 0
$rejected = $false
try { $null = $with.Invoke($null, [object[]]@($fn, 'Digit1', 'Home')) } catch { $rejected = $true }
if (-not $rejected) { throw 'Captured Fn source accepted' }
$legacy = $type.GetMethod('WithPgUp', $flags)
foreach ($usage in @(74,75)) {
    $result = [byte[]]$legacy.Invoke($null, [object[]]@($fresh, $usage))
    for ($i = 0; $i -lt 520; $i++) {
        $expected = if ($i -eq 355) { $usage } else { $fresh[$i] }
        if ($result[$i] -ne $expected) { throw 'Legacy PgUp preservation failed' }
    }
}
$shortcutPgUp = [byte[]]$with.Invoke($null, [object[]]@($fresh, 'PageUp', 'Ctrl+PageUp'))
$rejected = $false
try { $null = $legacy.Invoke($null, [object[]]@($shortcutPgUp, 74)) } catch { $rejected = $true }
if (-not $rejected) { throw 'Legacy accepted shortcut source' }
# Exact maximum JSON: longest allowed target at every source, plus CRLF stdout.
$maximum = [byte[]]$fresh.Clone()
foreach ($slot in $slots) { $maximum[8+4*$slot+1] = 3; $maximum[8+4*$slot+3] = 48 }
$bytes = [Text.Encoding]::UTF8.GetByteCount($read.Invoke($null, [object[]]@(,$maximum))) + 2
if ($bytes -ne 4297 -or $bytes -le 4096 -or $bytes -gt 8192) { throw "Unexpected output bound $bytes" }
"PASS: $count native mapping roundtrips; full preservation, capture agreement, unsupported refusal, legacy restrictions; maximum stdout $bytes bytes; no hardware I/O"
