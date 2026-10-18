# Compile and call pure builders/parser only. Never construct the Form or call input APIs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$text = Get-Content (Join-Path $PSScriptRoot '../native/knob-session.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Source not found' }
Add-Type -TypeDefinition $match.Groups[1].Value -ReferencedAssemblies System.Windows.Forms,System.Drawing
function Assert($condition, $message) { if (-not $condition) { throw $message } }
# Feed the production bounded parser only; no Form, stdin thread or session is created.
function Read-Command($parser, [string]$text) {
    $result = [KnobSession+ParentCommand]::None
    foreach ($character in $text.ToCharArray()) { $result = $parser.Read([int]$character) }
    return $result
}
Assert ([KnobSession+CommandParser]::MaxLength -eq 15) 'Command buffer bound'
foreach ($name in @('media', 'scroll', 'zoom', 'tabs', 'history')) {
    $profile = [KnobSession]::ParseProfile($name)
    Assert ([KnobSession]::ProfileName($profile) -ceq $name) 'Canonical profile name'
    foreach ($ending in @("`n", "`r`n")) {
        $parser = New-Object 'KnobSession+CommandParser'
        Assert ((Read-Command $parser "profile:$name$ending") -eq [KnobSession+ParentCommand]::Profile) "Profile command: $name"
        Assert ($parser.Profile -eq $profile) 'Parsed profile value'
        Assert ((Read-Command $parser "lease$ending") -eq [KnobSession+ParentCommand]::Lease) 'Lease after profile'
        Assert ((Read-Command $parser "stop$ending") -eq [KnobSession+ParentCommand]::Stop) 'Stop command'
        Assert ((Read-Command $parser "lease$ending") -eq [KnobSession+ParentCommand]::Invalid) 'Stop is terminal'
    }
}
foreach ($bad in @('', 'Lease', 'STOP', 'lease ', ' stop', 'profile:', 'profile:Media', 'Profile:media',
    'profile:MEDIA', 'profile:scroll ', 'profile:zoomx', 'profile:tabsx', 'profile:historyx',
    'profile:arbitrary', 'profile:media:1', "profile:media`rX", "profile:media`r`r", "profile:media`0")) {
    $parser = New-Object 'KnobSession+CommandParser'
    Assert ((Read-Command $parser "$bad`n") -eq [KnobSession+ParentCommand]::Invalid) "Accepted invalid command: $bad"
    Assert ((Read-Command $parser "lease`n") -eq [KnobSession+ParentCommand]::Invalid) 'Invalid command is terminal'
}
$parser = New-Object 'KnobSession+CommandParser'
Assert ((Read-Command $parser ('x' * 15)) -eq [KnobSession+ParentCommand]::None) 'Max length buffered without newline'
Assert ($parser.Read([int][char]'x') -eq [KnobSession+ParentCommand]::Invalid) 'Overlong command must fail immediately'
$parser = New-Object 'KnobSession+CommandParser'
Assert ((Read-Command $parser ('x' * 15 + "`n")) -eq [KnobSession+ParentCommand]::Invalid) 'Max length invalid command'
$parser = New-Object 'KnobSession+CommandParser'
Assert ((Read-Command $parser 'profile:history') -eq [KnobSession+ParentCommand]::None) 'Longest valid command needs newline'
Assert ($parser.Read(-1) -eq [KnobSession+ParentCommand]::Invalid) 'Partial command EOF'
$parser = New-Object 'KnobSession+CommandParser'
Assert ($parser.Read(-1) -eq [KnobSession+ParentCommand]::Invalid) 'Empty EOF'
$failed = $false
try { [KnobSession]::ProfileName([KnobSession+ActionProfile]999) | Out-Null } catch { $failed = $true }
Assert $failed 'Accepted unsupported profile name enum'
$marshal = [Runtime.InteropServices.Marshal]
Assert ([IntPtr]::Size -eq 8) 'Tests require x64'
Assert ($marshal::SizeOf([type][KnobSession+Input]) -eq 40) 'INPUT size'
Assert ($marshal::SizeOf([type][KnobSession+KeyboardInput]) -eq 24) 'KEYBDINPUT size'
Assert ($marshal::SizeOf([type][KnobSession+MouseInput]) -eq 32) 'MOUSEINPUT size'
Assert ($marshal::OffsetOf([type][KnobSession+Input], 'Value').ToInt32() -eq 8) 'INPUT union offset'
Assert ($marshal::OffsetOf([type][KnobSession+KeyboardInput], 'ExtraInfo').ToInt32() -eq 16) 'Keyboard marker offset'
Assert ($marshal::OffsetOf([type][KnobSession+MouseInput], 'ExtraInfo').ToInt32() -eq 24) 'Mouse marker offset'
# Each keyboard list is the exact down order; releases must be reverse order.
$cases = @(
    @('media', 'clockwise', @(0xaf)), @('media', 'counterclockwise', @(0xae)), @('media', 'press', @(0xb3)),
    @('zoom', 'clockwise', @(0x11, 0xbb)), @('zoom', 'counterclockwise', @(0x11, 0xbd)), @('zoom', 'press', @(0x11, 0x30)),
    @('tabs', 'clockwise', @(0x11, 9)), @('tabs', 'counterclockwise', @(0x11, 0x10, 9)), @('tabs', 'press', @(0x11, 0x54)),
    @('history', 'clockwise', @(0x11, 0x59)), @('history', 'counterclockwise', @(0x11, 0x5a)), @('history', 'press', @(0x11, 0x10, 0x5a))
)
foreach ($case in $cases) {
    $profile = [KnobSession]::ParseProfile($case[0])
    Assert ($profile.ToString().ToLowerInvariant() -ceq $case[0]) 'Profile enum mapping'
    $batch = [KnobSession]::BuildAction($profile, $case[1])
    $keys = $case[2]
    Assert ($batch.Length -eq 2 * $keys.Length) "Batch size: $case"
    for ($i = 0; $i -lt $batch.Length; $i++) {
        $input = $batch[$i]; $key = $input.Value.Keyboard
        $release = $i -ge $keys.Length
        $index = if ($release) { $batch.Length - 1 - $i } else { $i }
        Assert ($input.Type -eq 1 -and $key.Key -eq $keys[$index]) "Key order: $case"
        $expectedFlag = if ($release) { 2 } else { 0 }
        Assert ($key.Flags -eq $expectedFlag -and $key.Scan -eq 0 -and $key.Time -eq 0) 'Keyboard fields'
        Assert ($key.ExtraInfo.ToUInt64() -eq [KnobSession]::InjectionMarker) 'Keyboard marker'
    }
}
$scroll = [KnobSession]::ParseProfile('scroll')
foreach ($semantic in @('clockwise', 'counterclockwise', 'press')) {
    $batch = [KnobSession]::BuildAction($scroll, $semantic)
    $expectedCount = if ($semantic -eq 'press') { 2 } else { 1 }
    Assert ($batch.Length -eq $expectedCount) 'Mouse batch size'
    for ($i = 0; $i -lt $batch.Length; $i++) {
        $input = $batch[$i]; $mouse = $input.Value.Mouse
        $expectedFlags = if ($semantic -eq 'press') { if ($i -eq 0) { 0x20 } else { 0x40 } } else { 0x800 }
        $expectedData = if ($semantic -eq 'clockwise') { [uint32]4294967176 } elseif ($semantic -eq 'counterclockwise') { [uint32]120 } else { [uint32]0 }
        Assert ($input.Type -eq 0 -and $mouse.Flags -eq $expectedFlags -and $mouse.Data -eq $expectedData) 'Mouse action'
        Assert ($mouse.X -eq 0 -and $mouse.Y -eq 0 -and $mouse.Time -eq 0) 'Mouse fields'
        Assert ($mouse.ExtraInfo.ToUInt64() -eq [KnobSession]::InjectionMarker) 'Mouse marker'
    }
}
foreach ($bad in @('', 'Media', 'MEDIA', 'close', 'arbitrary')) {
    $failed = $false
    try { [KnobSession]::ParseProfile($bad) | Out-Null } catch { $failed = $true }
    Assert $failed "Accepted unsupported profile: $bad"
}
$failed = $false
try { [KnobSession]::BuildAction([KnobSession+ActionProfile]999, 'press') | Out-Null } catch { $failed = $true }
Assert $failed 'Accepted unsupported enum'
$failed = $false
try { [KnobSession]::BuildAction($scroll, 'other') | Out-Null } catch { $failed = $true }
Assert $failed 'Accepted unsupported semantic'
Assert ([KnobSession]::BypassHook(0x10, [KnobSession]::InjectionMarker)) 'Own injection must bypass'
Assert ([KnobSession]::BypassHook(0x12, [KnobSession]::InjectionMarker)) 'Own lower-integrity injection must bypass'
Assert (-not [KnobSession]::BypassHook(0, [KnobSession]::InjectionMarker)) 'Uninjected marker must not bypass'
Assert (-not [KnobSession]::BypassHook(0x10, 0)) 'Other injected input must not bypass'
Assert (-not [KnobSession]::BypassHook(0, 0)) 'Physical input must not bypass'
'PASS: bounded command parser, profile names, all 15 actions, exact fields, ABI sizes/offsets, balanced releases, allowlist and hook bypass. No input APIs invoked.'
