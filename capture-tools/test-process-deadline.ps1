$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'process-deadline.ps1')
$p=Start-Process "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList '-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 20"' -PassThru -WindowStyle Hidden
$deadline=$null
try {
    $clock=[Diagnostics.Stopwatch]::StartNew()
    $deadline=[AulaCaptureDeadline]::new($p,500)
    # Deliberately block supervisor thread, simulating delayed PowerShell loop.
    Start-Sleep -Seconds 2
    if(-not $p.HasExited -or -not $deadline.Expired -or $deadline.Failure) {throw 'Deadline failed'}
    'PASS: independent deadline terminated owned harmless child while supervisor slept; elapsed='+$clock.ElapsedMilliseconds+'ms'
} finally {
    if(-not $p.HasExited){$p.Kill();$null=$p.WaitForExit(3000)}
    if($deadline){$deadline.Dispose()}
    $p.Dispose()
}
$tokens=$null;$errors=$null
$null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'capture-brightness.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
'PASS: capture supervisor syntax. No USB capture or device reports.'
