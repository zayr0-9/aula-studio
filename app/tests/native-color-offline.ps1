$ErrorActionPreference='Stop'
$text=Get-Content (Join-Path $PSScriptRoot '../native/brightness.ps1') -Raw
$m=[regex]::Match($text,"(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
Add-Type -TypeDefinition $m.Groups[1].Value
$t=[AulaBrightnessTransport];$f=[Reflection.BindingFlags]'NonPublic,Static'
$paletteMethod=$t.GetMethod('WithFixedColorPalette',$f)
$configMethod=$t.GetMethod('WithFixedColourful',$f)
foreach($name in @('red','green','blue')) {
 $e=Get-Content (Join-Path $PSScriptRoot "../../docs/evidence/palette-query-$name.json") -Raw|ConvertFrom-Json
 $p=[byte[]]$e.response;$snapshot=[byte[]]$p.Clone()
 foreach($rgb in @(@(255,0,0),@(0,255,0),@(0,0,255),@(12,34,56))) {
  $actual=[byte[]]$paletteMethod.Invoke($null,[object[]]@($p,[int]$rgb[0],[int]$rgb[1],[int]$rgb[2]))
  for($i=0;$i-lt 520;$i++) {
   $expected=if($i-ge 29 -and $i-le 31){$rgb[$i-29]}else{$snapshot[$i]}
   if($actual[$i]-ne $expected -or $p[$i]-ne $snapshot[$i]){throw 'Palette preservation failure'}
  }
 }
 $bad=[byte[]]$p.Clone();$bad[514]=0
 $rejected=$false;try{$null=$paletteMethod.Invoke($null,[object[]]@($bad,1,2,3))}catch{$rejected=$true}
 if(-not $rejected){throw 'Bad marker accepted'}
}
$e=Get-Content (Join-Path $PSScriptRoot '../../docs/evidence/fixed-on-colors.json') -Raw|ConvertFrom-Json
foreach($cycle in $e.cycles){
 $c=New-Object byte[] 520;[Array]::Copy([byte[]]$cycle.response,$c,136)
 foreach($flag in @(0,1)){
  $a=[byte[]]$configMethod.Invoke($null,[object[]]@($c.PSObject.BaseObject,[int]$flag))
  for($i=0;$i-lt 520;$i++){
   $expected=if($i-eq 67){($c[$i]-band 240)-bor $(if($flag-eq 1){7}else{0})}else{$c[$i]}
   if($a[$i]-ne $expected){throw 'Config preservation failure'}
  }
 }
}
'PASS production color encoder: RGB fixtures/preservation, toggle packed-bit preservation and bad marker rejection; no hardware access'
