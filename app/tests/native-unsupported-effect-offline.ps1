$ErrorActionPreference='Stop'
$text=Get-Content (Join-Path $PSScriptRoot '../native/brightness.ps1') -Raw
$m=[regex]::Match($text,"(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
Add-Type -TypeDefinition $m.Groups[1].Value
$method=[AulaBrightnessTransport].GetMethod('ValidateOrdinaryConfiguration',[Reflection.BindingFlags]'NonPublic,Static')
foreach($selector in @(0,1,4,11,17,255)) {
 $bytes=New-Object byte[] 520;$bytes[18]=$selector;$bytes[134]=90;$bytes[135]=165
 $null=$method.Invoke($null,[object[]](,$bytes.PSObject.BaseObject))
 foreach($bad in @('custom','marker')) {
  $copy=[byte[]]$bytes.Clone()
  if($bad-eq 'custom'){$copy[17]=1}else{$copy[134]=0}
  $rejected=$false;try{$null=$method.Invoke($null,[object[]](,$copy))}catch{$rejected=$true}
  if(-not $rejected){throw 'Invalid marker/custom accepted'}
 }
}
'PASS native ordinary selector acceptance; custom/invalid markers refused; no device access'
