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
