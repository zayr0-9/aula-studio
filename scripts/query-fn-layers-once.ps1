# Explicit authorized diagnostic only. No configuration/matrix setter or restoration.
param([switch]$CompileCheck, [switch]$OfflineTest)
$ErrorActionPreference = 'Stop'
$text = Get-Content (Join-Path $PSScriptRoot '../app/native/brightness.ps1') -Raw
$match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
if (-not $match.Success) { throw 'Reviewed native source not found' }
$method = @'
public static byte[] FnLayerQuery(int layer) {
    if (layer < 0 || layer > 2) throw new ArgumentException("Only layers0/1/2 allowed.");
    byte[] query = new byte[520];
    byte[] header = {6,0x83,(byte)layer,0,1,0,0,2};
    Array.Copy(header,query,8);
    return query;
}
public static void ValidateFnLayer(byte[] response, int layer) {
    byte[] query = FnLayerQuery(layer);
    if (response == null || response.Length != 520) throw new ArgumentException("Invalid response length.");
    for (int i=0;i<8;i++) if(response[i]!=query[i]) throw new InvalidOperationException("Layer response header mismatch.");
    if (response[516]!=0 || response[517]!=0 || response[518]!=0x5a || response[519]!=0xa5)
        throw new InvalidOperationException("Layer response signature mismatch.");
}
public static byte[][] SnapshotFnLayers() {
    if (IntPtr.Size!=8 || Marshal.SizeOf(typeof(InterfaceData))!=32 || Marshal.SizeOf(typeof(Caps))!=64 ||
        Marshal.SizeOf(typeof(ValueCaps))!=72 || Marshal.SizeOf(typeof(Attributes))!=12)
        throw new InvalidOperationException("Unexpected ABI.");
    using(var mutex=new Mutex(false,@"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
        bool owned=false;
        try {
            try { owned=mutex.WaitOne(0); }
            catch(AbandonedMutexException) { owned=true; throw new InvalidOperationException("Interrupted prior operation; aborting."); }
            if(!owned) throw new InvalidOperationException("Device operation active.");
            CheckOfficialApp(); string path=FindCollection(); CheckOfficialApp();
            using(var handle=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
                Check(!handle.IsInvalid,"Open collection"); VerifyCollection(handle);
                byte[][] reports=new byte[3][];
                for(int layer=0;layer<3;layer++) {
                    byte[] query=FnLayerQuery(layer);
                    CheckOfficialApp(); Check(HidD_SetFeature(handle,query,520),"Matrix layer query");
                    Thread.Sleep(25);
                    byte[] response=new byte[520]; response[0]=6;
                    CheckOfficialApp(); Check(HidD_GetFeature(handle,response,520),"Matrix layer response");
                    ValidateFnLayer(response,layer); reports[layer]=response;
                }
                return reports;
            }
        } finally { if(owned) mutex.ReleaseMutex(); }
    }
}
'@
$marker = 'public static bool ConfigurationWriteAttempted'
if (($match.Groups[1].Value.Split(@($marker), [StringSplitOptions]::None)).Length -ne 2) { throw 'Unexpected native injection marker' }
$source = $match.Groups[1].Value.Replace($marker, $method + "`n" + $marker)
Add-Type -TypeDefinition $source
if ($CompileCheck) { 'PASS: compile only; no device I/O'; exit 0 }
if ($OfflineTest) {
    foreach ($layer in 0..2) {
        $query = [AulaBrightnessTransport]::FnLayerQuery($layer)
        if ($query.Length -ne 520 -or ($query[0..7] -join ',') -ne "6,131,$layer,0,1,0,0,2") { throw 'Wrong query' }
        if (@($query[8..519] | Where-Object { $_ -ne 0 }).Count) { throw 'Nonzero query payload' }
        $response = [byte[]]$query.Clone(); $response[518]=0x5a; $response[519]=0xa5
        [AulaBrightnessTransport]::ValidateFnLayer($response,$layer)
        foreach ($offset in @(0,1,2,3,4,5,6,7,516,517,518,519)) {
            $bad = [byte[]]$response.Clone(); $bad[$offset]=$bad[$offset] -bxor 1
            $rejected=$false
            try { [AulaBrightnessTransport]::ValidateFnLayer($bad,$layer) } catch { $rejected=$true }
            if (-not $rejected) { throw 'Malformed response accepted' }
        }
        foreach ($length in @(0,519,521)) {
            $rejected=$false
            try { [AulaBrightnessTransport]::ValidateFnLayer((New-Object byte[] $length),$layer) } catch { $rejected=$true }
            if (-not $rejected) { throw 'Wrong length accepted' }
        }
    }
    foreach ($layer in @(-1,3,255)) {
        $rejected=$false
        try { $null=[AulaBrightnessTransport]::FnLayerQuery($layer) } catch { $rejected=$true }
        if (-not $rejected) { throw 'Unsupported layer accepted' }
    }
    'PASS: all3 query headers, zero payloads, malformed header/signature/length refusal, layer allowlist; no device I/O'
    exit 0
}
if (Get-Process OemDrv -ErrorAction SilentlyContinue) { throw 'Official app running' }
# Studio also must be closed. Do not reject unrelated Electron apps such as Graviton.
$studio = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'electron.exe' -and $_.CommandLine -match '(?i)aula[\\/]app'
})
if ($studio.Count) { throw 'Studio process present; close Studio before reading' }
$reports = [AulaBrightnessTransport]::SnapshotFnLayers()
$layers = @(foreach ($layer in 0..2) {
    [ordered]@{layer=$layer; queryHeader=[int[]]([AulaBrightnessTransport]::FnLayerQuery($layer)[0..7]); response=[int[]]$reports[$layer]}
})
$path = Join-Path $PSScriptRoot ('../docs/evidence/fn-layers-read-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
[ordered]@{time=(Get-Date -Format o); layers=$layers; apiSuccess=$true; actualTransferLengthKnown=$false; setFeatureQueryCalls=3; getFeatureCalls=3; assignmentWrites=0; note='Fresh layer0/1/2 queries only; no retry, restoration or complete backup guarantee. Boolean GetFeature does not attest actual transferred length.'} | ConvertTo-Json -Depth 6 | Set-Content $path -Encoding utf8
'Evidence='+[IO.Path]::GetFullPath($path)
