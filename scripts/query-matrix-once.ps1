# Explicit read experiment: one layer0 query. No matrix/config setter or restoration.
param([switch]$CompileCheck)
$ErrorActionPreference = 'Stop'
if (Get-Process OemDrv -ErrorAction SilentlyContinue) { throw 'Official app running' }
$text = Get-Content (Join-Path $PSScriptRoot '../app/native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Reviewed native source not found' }
$method = @'
public static byte[] SnapshotLayerZero() {
    if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(InterfaceData)) != 32 || Marshal.SizeOf(typeof(Caps)) != 64)
        throw new InvalidOperationException("Unexpected ABI");
    using (var mutex = new Mutex(false, @"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
        bool owned = false;
        try {
            try { owned = mutex.WaitOne(0); }
            catch (AbandonedMutexException) { owned=true; throw new InvalidOperationException("Interrupted prior operation"); }
            if (!owned) throw new InvalidOperationException("Device operation active");
            CheckOfficialApp();
            string path=FindCollection();
            CheckOfficialApp();
            using(var handle=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
                Check(!handle.IsInvalid,"Open collection"); VerifyCollection(handle);
                byte[] query=new byte[520]; byte[] header={6,0x83,0,0,1,0,0,2}; Array.Copy(header,query,8);
                CheckOfficialApp(); Check(HidD_SetFeature(handle,query,520),"Layer0 query");
                Thread.Sleep(25);
                byte[] response=new byte[520]; response[0]=6;
                CheckOfficialApp(); Check(HidD_GetFeature(handle,response,520),"Layer0 response");
                for(int i=0;i<8;i++) if(response[i]!=header[i]) throw new InvalidOperationException("Matrix response header mismatch");
                return response;
            }
        } finally { if(owned) mutex.ReleaseMutex(); }
    }
}
'@
$source = $match.Groups[1].Value.Replace('public static bool ConfigurationWriteAttempted', $method + "`npublic static bool ConfigurationWriteAttempted")
Add-Type -TypeDefinition $source
if ($CompileCheck) { 'Compile-only passed; no device I/O'; exit 0 }
$report = [AulaBrightnessTransport]::SnapshotLayerZero()
$path = Join-Path $PSScriptRoot ('../docs/evidence/matrix-layer0-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
[ordered]@{time=(Get-Date -Format o); layer=0; queryHeader=@(6,131,0,0,1,0,0,2); response=[int[]]$report; apiSuccess=$true; actualTransferLengthKnown=$false; setFeatureCalls=1;getFeatureCalls=1;note='Layer0 snapshot only, not complete keyboard backup. No remapping write. HidD_GetFeature exposes no actual length.'} | ConvertTo-Json -Depth 4 | Set-Content $path -Encoding utf8
'Evidence='+[IO.Path]::GetFullPath($path)
