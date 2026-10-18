# Explicit temporary GLOBAL media-key suppression test. No input injection/device writes.
param([switch]$CompileCheck)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$text = Get-Content (Join-Path $PSScriptRoot 'observe-knob-hook.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Reviewed hook source not found' }
$source = $match.Groups[1].Value
$old = 'return CallNextHookEx(hook,code,message,data);'
$new = @'
if(code>=0 && clock.ElapsedMilliseconds < 30000) {
            int key=Marshal.ReadInt32(data);
            if(key==0xad || key==0xae || key==0xaf) return new IntPtr(1);
        }
        return CallNextHookEx(hook,code,message,data);
'@
if (-not $source.Contains($old)) { throw 'Hook source changed; refusal to patch unknown code' }
$source = $source.Replace($old, $new)
$source = $source.Replace('Media-key hook observation - 30 seconds, pass-through', 'GLOBAL media suppression TEST - closes after 30 seconds')
$source = $source.Replace('Observation only; volume/mute still operate.', 'GLOBAL TEST: volume up/down/mute blocked for ALL devices.')
$source = $source.Replace('3 slow clockwise detents, pause, 3 counterclockwise, pause, 2 presses.', 'Turn 1 detent each direction, then press once. Watch Windows volume/mute.')
$source = $source.Replace('Pass-through global media-key observation only; no source identity;', 'Temporary GLOBAL media suppression test; no source identity;')
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
if ($CompileCheck) { 'Compile-only passed; no hook installed.'; exit 0 }
[MediaHookObserver]::Observe()
