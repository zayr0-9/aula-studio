# Explicit interactive hardware test. No device I/O unless -Run is supplied.
# Uses only production ReadPgUp/SetPgUp (base-layer physical PgUp -> Home/PgUp).
param([switch]$Run, [switch]$CompileCheck, [switch]$RemapPair)
$ErrorActionPreference = 'Stop'
# Default workflow is now the whole ordinary-key inventory; old pair test is opt-in.
if (-not $RemapPair) {
    & (Join-Path $PSScriptRoot 'verify-keyboard-keys.ps1') -Run:$Run -CompileCheck:$CompileCheck
    return
}
if ($Run -and $CompileCheck) { throw 'Choose Run or CompileCheck, not both.' }
Add-Type -AssemblyName System.Windows.Forms
$source = @'
using System;
using System.Windows.Forms;
public sealed class RemapPhysicalPrompt : Form {
    readonly Timer timer = new Timer();
    readonly System.Diagnostics.Stopwatch elapsed = new System.Diagnostics.Stopwatch();
    readonly int expected;
    string result = "cancelled";
    bool armed;
    public RemapPhysicalPrompt(int expected, string stage) {
        this.expected=expected;
        Text="F75 physical PgUp test - "+stage;
        Width=720; Height=260; KeyPreview=true;
        var label=new Label { Dock=DockStyle.Fill, Text="Click Arm, then physically PRESS AND RELEASE the PgUp key once.\r\nExpected Windows event: "+(expected==36?"Home":"PageUp")+".\r\nDo not press Home or use another keyboard. Only Home/PageUp events are inspected.\r\nThis focused-window test cannot identify which keyboard sent the event.\r\nClose/Cancel stops testing; restoration is attempted using a fresh device read." };
        var cancel=new Button { Text="Cancel test", Dock=DockStyle.Bottom, Height=36 };
        cancel.Click+=delegate { Close(); };
        var arm=new Button { Text="Arm physical test", Dock=DockStyle.Bottom, Height=36 };
        arm.Click+=delegate { armed=true; arm.Enabled=false; label.Text="Armed: physically press and release PgUp now.\r\nExpected: "+(expected==36?"Home":"PageUp")+". Timeout: 20 seconds."; elapsed.Restart(); timer.Start(); };
        Controls.Add(label); Controls.Add(cancel); Controls.Add(arm);
        timer.Interval=100;
        timer.Tick+=delegate { if(elapsed.ElapsedMilliseconds>=20000) { result="timeout"; Close(); } };
    }
    bool down;
    protected override void OnKeyDown(KeyEventArgs e) {
        if(armed && (e.KeyCode==Keys.Home || e.KeyCode==Keys.PageUp)) {
            e.SuppressKeyPress=true;
            if((int)e.KeyCode!=expected || e.Modifiers!=Keys.None) { result="wrong-key"; Close(); }
            else down=true;
        }
        base.OnKeyDown(e);
    }
    protected override void OnKeyUp(KeyEventArgs e) {
        if(armed && down && (e.KeyCode==Keys.Home || e.KeyCode==Keys.PageUp)) {
            e.SuppressKeyPress=true;
            result=((int)e.KeyCode==expected && e.Modifiers==Keys.None)?"passed":"wrong-key";
            Close();
        }
        base.OnKeyUp(e);
    }
    protected override void OnFormClosed(FormClosedEventArgs e) { timer.Stop(); timer.Dispose(); base.OnFormClosed(e); }
    public static string Ask(int expected, string stage) {
        using(var form=new RemapPhysicalPrompt(expected,stage)) { Application.Run(form); return form.result; }
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
if ($CompileCheck) { 'PASS prompt compile; no device I/O, input registration, hooks or key injection.'; exit 0 }
if (-not $Run) { 'No device contacted. Use -Run for the explicit PgUp/Home physical test, -CompileCheck for offline validation.'; exit 0 }
$helper = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../app/native/brightness.ps1'))
function Assert-AppsClosed {
    if (Get-Process OemDrv,electron -ErrorAction SilentlyContinue) { throw 'Close official AULA app and Studio/Electron before testing.' }
}
function Invoke-Mapping([string]$Action, [int]$Usage=-1) {
    Assert-AppsClosed
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $info.Arguments='-NoProfile -NonInteractive -File "'+$helper+'" -Action '+$Action
    if($Usage -ne -1){$info.Arguments+=' -PgUp '+$Usage}
    $info.UseShellExecute=$false; $info.CreateNoWindow=$true
    $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
    $process=[Diagnostics.Process]::new(); $process.StartInfo=$info
    try {
        if(-not $process.Start()){throw 'Helper failed to start'}
        $output=$process.StandardOutput.ReadToEndAsync(); $errorOutput=$process.StandardError.ReadToEndAsync()
        if(-not $process.WaitForExit(15000)) {
            $process.Kill(); $null=$process.WaitForExit(3000)
            throw 'Mapping helper timed out; outcome uncertain. No automatic retry.'
        }
        if($process.ExitCode -ne 0){throw ('Mapping helper failed: '+$errorOutput.Result)}
        $result=$output.Result.Trim()|ConvertFrom-Json
        if(($result -isnot [int] -and $result -isnot [long]) -or $result -notin @(74,75)){throw 'Invalid mapping helper result'}
        if($Usage -ne -1 -and $result -ne $Usage){throw 'Mapping readback mismatch'}
        return [int]$result
    } finally { $process.Dispose() }
}
Assert-AppsClosed
$initial=Invoke-Mapping 'ReadPgUp'
if($initial -ne 75){throw 'Physical PgUp is not currently assigned PgUp. No changes made.'}
$record=[ordered]@{time=(Get-Date -Format o);initialUsage=$initial;baselinePhysical='not-run';homeReadback=$false;homePhysical='not-run';restoreAttempted=$false;restored=$false;restoredPhysical='not-run';error=$null;note='Focused Windows events require honest physical PgUp press; no device source identity. No synthesized input. Only base PgUp/Home supported.'}
$attempted=$false
try {
    $record.baselinePhysical=[RemapPhysicalPrompt]::Ask(33,'original PgUp')
    if($record.baselinePhysical -ne 'passed'){throw ('Baseline physical test: '+$record.baselinePhysical)}
    Assert-AppsClosed
    $attempted=$true # A failed setter can still have applied.
    $null=Invoke-Mapping 'SetPgUp' 74
    $record.homeReadback=$true
    $record.homePhysical=[RemapPhysicalPrompt]::Ask(36,'remapped to Home')
    if($record.homePhysical -ne 'passed'){throw ('Remapped physical test: '+$record.homePhysical)}
} catch { $record.error=$_.Exception.Message }
finally {
    if($attempted){
        $record.restoreAttempted=$true
        try {
            # Production SetPgUp re-reads current layer and changes ONLY PgUp usage.
            # No saved whole-layer restoration or blind retry.
            $null=Invoke-Mapping 'SetPgUp' 75
            $record.restored=$true
        } catch { $record.error=([string]$record.error+' RESTORATION FAILED: '+$_.Exception.Message) }
    }
}
if($record.restored -and -not $record.error){$record.restoredPhysical=[RemapPhysicalPrompt]::Ask(33,'restored PgUp')}
$path=Join-Path $PSScriptRoot ('../docs/evidence/physical-remap-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$record|ConvertTo-Json -Depth 4|Set-Content $path -Encoding utf8
$record|ConvertTo-Json -Depth 4
'Evidence='+[IO.Path]::GetFullPath($path)
if($record.error -or -not $record.restored -or $record.restoredPhysical -ne 'passed'){throw 'Test incomplete/failed. Inspect evidence; do not blindly rerun. Closing/killing PowerShell, unplugging, or official app reopening can prevent restoration.'}
