# Executes the production pure mapping method via reflection. Never calls Run/Query/device APIs.
$ErrorActionPreference = 'Stop'
$text = Get-Content (Join-Path $PSScriptRoot '../native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Native source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value
$method = [AulaBrightnessTransport].GetMethod('WithBrightness', [Reflection.BindingFlags]'NonPublic,Static')
if (-not $method) { throw 'Production brightness encoder not found' }
$count = 0
foreach ($fixture in @('fixed-on-brightness.json', 'ansi-brightness-capture.json')) {
    $data = Get-Content (Join-Path $PSScriptRoot "../../docs/evidence/$fixture") -Raw | ConvertFrom-Json
    if ($fixture -eq 'fixed-on-brightness.json') {
        $reports = @($data.cycles | Where-Object { $_.write[18] -eq 1 } | ForEach-Object { ,([byte[]]$_.write) })
    } else {
        $reports = @($data.controls | Where-Object { $_.frame -eq 59 } | ForEach-Object { ,([byte[]]$_.body[8..527]) })
    }
    if ($reports.Count -eq 0) { throw 'Missing fixture reports' }
    foreach ($report in $reports) {
        $offset = if ($report[18] -eq 1) { 8 + 0x3a } else { 8 + 0x4e }
        $snapshot = [byte[]]$report.Clone()
        foreach ($value in 0..9) {
            $result = [byte[]]$method.Invoke($null, [object[]]@($report, $value))
            for ($i = 0; $i -lt $report.Length; $i++) {
                $expected = if ($i -eq $offset) { $value } else { $snapshot[$i] }
                if ($result[$i] -ne $expected -or $report[$i] -ne $snapshot[$i]) { throw "Preservation failure at $i" }
            }
            $count++
        }
        foreach ($value in @(-1, 10)) {
            $rejected = $false
            try { $null = $method.Invoke($null, [object[]]@($report, $value)) } catch { $rejected = $true }
            if (-not $rejected) { throw 'Invalid value accepted' }
        }
    }
}
foreach ($mode in @(17, 0, 99)) {
    $report = [byte[]]::new(520)
    $report[18] = $mode
    $rejected = $false
    try { $null = $method.Invoke($null, [object[]]@($report, 4)) } catch { $rejected = $true }
    if (-not $rejected) { throw 'Unsupported mode accepted' }
}
"PASS: $count production-native brightness mapping cases; input preservation, bounds and unsupported modes; no device access"

$combined = [AulaBrightnessTransport].GetMethod('WithEffectBrightness', [Reflection.BindingFlags]'NonPublic,Static')
if (-not $combined) { throw 'Production combined encoder not found' }
$combinedCount = 0
foreach ($sourceMode in @(1, 11, 17)) {
    # Distinct nonzero bytes make accidental clearing/copying of unrelated fields visible.
    $report = [byte[]]::new(520)
    for ($i = 0; $i -lt $report.Length; $i++) { $report[$i] = (($i * 37 + 13) % 256) }
    $report[18] = $sourceMode
    $report[8 + 0x3a] = 3
    $report[8 + 0x4e] = 7
    $snapshot = [byte[]]$report.Clone()
    foreach ($target in @(1, 11)) {
        $offset = if ($target -eq 1) { 8 + 0x3a } else { 8 + 0x4e }
        foreach ($value in 0..9) {
            $result = [byte[]]$combined.Invoke($null, [object[]]@($report, $target, $value))
            if ($result.Length -ne $report.Length) { throw 'Combined result length changed' }
            for ($i = 0; $i -lt $report.Length; $i++) {
                $expected = if ($i -eq 18) { $target } elseif ($i -eq $offset) { $value } else { $snapshot[$i] }
                if ($result[$i] -ne $expected -or $report[$i] -ne $snapshot[$i]) { throw "Combined preservation failure at $i" }
            }
            $combinedCount++
        }
    }
    foreach ($invalid in @(@(17, 4), @(0, 4), @(99, 4), @(-1, 4), @(1, -1), @(1, 10), @(11, -1), @(11, 10))) {
        $rejected = $false
        try { $null = $combined.Invoke($null, [object[]]@($report, $invalid[0], $invalid[1])) } catch { $rejected = $true }
        if (-not $rejected) { throw 'Invalid combined arguments accepted' }
        for ($i = 0; $i -lt $report.Length; $i++) {
            if ($report[$i] -ne $snapshot[$i]) { throw 'Rejected combined operation mutated input' }
        }
    }
}
"PASS: $combinedCount production-native combined mapping cases; sources 1/11/17, targets 1/11, bounds and full preservation; no device access"

# Static indicator tests use synthetic buffers only; never call RunIndicators/device APIs.
$flags = [Reflection.BindingFlags]'NonPublic,Static'
$indicator = [AulaBrightnessTransport].GetMethod('WithIndicator', $flags)
$validate = [AulaBrightnessTransport].GetMethod('ValidateIndicatorBlock', $flags)
$json = [AulaBrightnessTransport].GetMethod('IndicatorsResult', $flags)
function Assert-Rejected($Method, [object[]]$Arguments) {
    $rejected = $false
    try { $null = $Method.Invoke($null, $Arguments) } catch { $rejected = $true }
    if (-not $rejected) { throw 'Invalid indicator input accepted' }
}
$table = [byte[]]::new(520)
[byte[]]$header = @(6,134,0,0,1,0,128,1)
[Array]::Copy($header, $table, 8)
for ($i = 8; $i -lt 392; $i++) { $table[$i] = (($i * 37 + 13) % 256) }
$snapshot = [byte[]]$table.Clone()
foreach ($digit in 1..4) {
    $slot = 7 + 6 * ($digit - 1)
    $copy = [byte[]]$indicator.Invoke($null, [object[]]@($table, "number$digit", 0, 128, 255))
    for ($i = 0; $i -lt 520; $i++) {
        $expected = if ($i -eq 8+$slot) { 0 } elseif ($i -eq 134+$slot) { 128 } elseif ($i -eq 260+$slot) { 255 } else { $snapshot[$i] }
        if ($copy[$i] -ne $expected -or $table[$i] -ne $snapshot[$i]) { throw "Indicator preservation failed at $i" }
    }
    $decoded = $json.Invoke($null, [object[]]@(,$copy)) | ConvertFrom-Json
    $rgb = $decoded."Digit$digit"
    if ($rgb.red -ne 0 -or $rgb.green -ne 128 -or $rgb.blue -ne 255) { throw 'Indicator JSON decoding failed' }
    $noop = [byte[]]$indicator.Invoke($null, [object[]]@($copy, "number$digit", 0, 128, 255))
    for ($i = 0; $i -lt 520; $i++) { if ($noop[$i] -ne $copy[$i]) { throw 'No-op encoder changed table' } }
}
foreach ($invalid in @(@('Digit1',0,0,0), @('number5',0,0,0), @('number1',-1,0,0), @('number1',0,256,0), @('number1',0,0,256))) {
    Assert-Rejected $indicator ([object[]]@($table,$invalid[0],$invalid[1],$invalid[2],$invalid[3]))
}
foreach ($offset in @(0,1,2,3,4,5,6,7,392,519)) {
    $bad = [byte[]]$table.Clone(); $bad[$offset] = $bad[$offset] -bxor 1
    Assert-Rejected $validate ([object[]]@($bad,$false,$false))
}
Assert-Rejected $validate ([object[]]@([byte[]]::new(519),$false,$false))
$config = [byte[]]::new(520)
[byte[]]$configHeader = @(6,132,0,0,1,0,128,0)
[Array]::Copy($configHeader,$config,8)
$config[134] = 90; $config[135] = 165
foreach ($selector in @(0,1,11,17,99,255)) {
    $config[18] = $selector
    $null = $validate.Invoke($null,[object[]]@($config,$true,$true))
    Assert-Rejected $validate ([object[]]@($config,$true,$false))
}
$config[17] = 1; $config[18] = 21; $config[67] = 64
$null = $validate.Invoke($null,[object[]]@($config,$true,$false))
$null = $validate.Invoke($null,[object[]]@($config,$true,$true))
$ordinary = [AulaBrightnessTransport].GetMethod('ValidateOrdinaryConfiguration',$flags)
Assert-Rejected $ordinary ([object[]]@(,$config))
foreach ($offset in @(17,18,67,134,135,136,519)) {
    $bad = [byte[]]$config.Clone(); $bad[$offset] = if ($offset -eq 17) { 2 } else { $bad[$offset] -bxor 1 }
    Assert-Rejected $validate ([object[]]@($bad,$true,$true))
}
if ([AulaBrightnessTransport]::ConfigurationWriteAttempted) { throw 'Offline tests attempted a setter' }
'PASS: native static indicator mapping, full opaque-tail preservation, JSON, no-op, bounds/header/padding and mode-aware metadata admission; no device access'
