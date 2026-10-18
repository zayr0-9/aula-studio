# Combines reviewed pass-through observers on one monotonic timebase. No suppression/injection.
param([switch]$CompileCheck)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
function Get-ObserverSource([string]$name) {
    $text = Get-Content (Join-Path $PSScriptRoot $name) -Raw
    $match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
    if (-not $match.Success) { throw 'Observer source not found' }
    return $match.Groups[1].Value
}
$raw = Get-ObserverSource 'observe-knob.ps1'
$hook = Get-ObserverSource 'observe-knob-hook.ps1'
$raw = $raw.Replace('readonly System.Diagnostics.Stopwatch clock = new System.Diagnostics.Stopwatch();', 'readonly System.Diagnostics.Stopwatch clock = SharedClock.Clock;').Replace('clock.Start();', '')
$hook = $hook.Replace('readonly Stopwatch clock=new Stopwatch();', 'readonly Stopwatch clock=SharedClock.Clock;').Replace('clock.Start();', '')
$source = "public static class SharedClock { public static readonly System.Diagnostics.Stopwatch Clock = new System.Diagnostics.Stopwatch(); }`nnamespace RawObserver {`n$raw`n}`nnamespace HookObserver {`n$hook`n}"
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
if ($CompileCheck) { 'Combined compile-only passed; no input registration or hooks.'; exit 0 }
$rawForm = New-Object RawObserver.KnobObserver
$hookForm = New-Object HookObserver.MediaHookObserver
$flags = [Reflection.BindingFlags]'NonPublic,Instance'
try {
    [SharedClock]::Clock.Start()
    $rawForm.Show()
    [System.Windows.Forms.Application]::Run($hookForm)
    $rawForm.Close()
    foreach ($entry in @(@('RAW', $rawForm), @('HOOK', $hookForm))) {
        $form = $entry[1]
        $type = $form.GetType()
        $failure = $type.GetField('failure', $flags).GetValue($form)
        if ($failure) { throw ($entry[0] + ': ' + $failure) }
        $overflow = $type.GetField('overflow', $flags).GetValue($form)
        if ($overflow) { throw ($entry[0] + ': overflow') }
    }
    'Shared monotonic timestamps; RAW exact F75 COL02; HOOK global media keys; all pass-through.'
    foreach ($entry in @(@('RAW', $rawForm), @('HOOK', $hookForm))) {
        $form = $entry[1]
        foreach ($line in $form.GetType().GetField('events', $flags).GetValue($form)) {
            $entry[0] + ' ' + $line
        }
    }
} finally {
    $hookForm.Close()
    $rawForm.Close()
    $hookForm.Dispose()
    $rawForm.Dispose()
}
