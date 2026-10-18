# Pure lease state testing through uninitialized instance. No Form/hook/RawInput creation.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$text = Get-Content (Join-Path $PSScriptRoot '../native/knob-session.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value -ReferencedAssemblies System.Windows.Forms,System.Drawing
$flags = [Reflection.BindingFlags]'NonPublic,Instance'
$type = [KnobSession]
$instance = [Runtime.Serialization.FormatterServices]::GetUninitializedObject($type)
$lease = $type.GetField('lease', $flags)
$started = $type.GetField('started', $flags)
$live = $type.GetMethod('Live', $flags)
$renew = $type.GetMethod('Renew', $flags)
$now = [Diagnostics.Stopwatch]::GetTimestamp()
$started.SetValue($instance, $now)
$lease.SetValue($instance, $now)
if (-not $live.Invoke($instance, @())) { throw 'Fresh lease not live' }
$lease.SetValue($instance, [long]($now - [Diagnostics.Stopwatch]::Frequency * 3))
if ($live.Invoke($instance, @())) { throw 'Expired lease still live' }
$null = $renew.Invoke($instance, @())
if ($live.Invoke($instance, @())) { throw 'Expired lease revived' }
$lease.SetValue($instance, [long]-1)
$null = $renew.Invoke($instance, @())
if ($live.Invoke($instance, @())) { throw 'Stopped lease revived' }
$lease.SetValue($instance, [Diagnostics.Stopwatch]::GetTimestamp())
$started.SetValue($instance, [long]($now - [Diagnostics.Stopwatch]::Frequency * 901))
if ($live.Invoke($instance, @())) { throw 'Session duration bound ignored' }
'PASS: live, lease expiry, terminal stop, late renewal, 15-minute bound. No input APIs invoked.'
