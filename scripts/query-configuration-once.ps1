# Default: single captured query. -BrightnessTest: authorized guarded 9->8->9 test.
# No reset, firmware, pairing or automatic retry. Restoration is attempted once.
# Synchronous HID calls may hang; process termination/disconnect can prevent restoration.
param([switch]$BrightnessTest)
$ErrorActionPreference = 'Stop'
if (Get-Process OemDrv -ErrorAction SilentlyContinue) { throw 'Official application is running; aborting.' }
$source = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
public static class AulaOneQuery {
    [StructLayout(LayoutKind.Sequential)] public struct InterfaceData {
        public uint Size; public Guid ClassGuid; public uint Flags; public IntPtr Reserved;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Caps {
        public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst=17)] public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputIndices;
        public ushort NumberOutputButtonCaps, NumberOutputValueCaps, NumberOutputIndices;
        public ushort NumberFeatureButtonCaps, NumberFeatureValueCaps, NumberFeatureIndices;
    }
    [StructLayout(LayoutKind.Explicit, Size=72)] public struct ValueCaps {
        [FieldOffset(2)] public byte ReportID;
    }
    [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid guid);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid guid, IntPtr enumerator, IntPtr parent, uint flags);
    [DllImport("setupapi.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr device, ref Guid guid, uint index, ref InterfaceData data);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref InterfaceData data, IntPtr detail, uint size, out uint required, IntPtr device);
    [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFile(string path, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_GetPreparsedData(SafeFileHandle handle, out IntPtr data);
    [DllImport("hid.dll")] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_FreePreparsedData(IntPtr data);
    [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr data, out Caps caps);
    [DllImport("hid.dll")] static extern int HidP_GetValueCaps(int type, [Out] ValueCaps[] caps, ref ushort length, IntPtr data);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_SetFeature(SafeFileHandle handle, byte[] report, int length);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_GetFeature(SafeFileHandle handle, [In,Out] byte[] report, int length);
    static void Check(bool success, string operation) {
        if (!success) throw new InvalidOperationException(operation + " failed, Win32=" + Marshal.GetLastWin32Error());
    }
    static byte[] Query(SafeFileHandle handle) {
        var query=new byte[520]; byte[] header={6,0x84,0,0,1,0,128,0}; Array.Copy(header,query,8);
        Check(HidD_SetFeature(handle,query,520),"Configuration query");
        Thread.Sleep(25);
        var response=new byte[520]; response[0]=6;
        Check(HidD_GetFeature(handle,response,520),"Configuration response");
        for(int i=0;i<8;i++) if(response[i]!=header[i]) throw new InvalidOperationException("Invalid response header");
        for(int i=136;i<520;i++) if(response[i]!=0) throw new InvalidOperationException("Invalid response padding");
        if(response[8+0x7e]!=0x5a || response[8+0x7f]!=0xa5 || response[18]!=11 || response[17]!=0) throw new InvalidOperationException("Unsupported mode/marker");
        return response;
    }
    static void Match(byte[] actual, byte[] expected) {
        for(int i=0;i<128;i++) if(actual[8+i]!=expected[8+i]) throw new InvalidOperationException("Configuration mismatch at "+i);
    }
    public static object Run(bool brightnessTest, byte[] expected) {
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(InterfaceData)) != 32 || Marshal.SizeOf(typeof(Caps)) != 64 || Marshal.SizeOf(typeof(ValueCaps)) != 72) throw new InvalidOperationException("Unexpected ABI");
        Guid guid; HidD_GetHidGuid(out guid);
        IntPtr set=SetupDiGetClassDevs(ref guid,IntPtr.Zero,IntPtr.Zero,0x12);
        if(set==new IntPtr(-1)) throw new InvalidOperationException("Device enumeration failed");
        var paths=new List<string>(); bool complete=false;
        try {
            for(uint index=0;index<512;index++) {
                var data=new InterfaceData(); data.Size=32;
                if(!SetupDiEnumDeviceInterfaces(set,IntPtr.Zero,ref guid,index,ref data)) {
                    int error=Marshal.GetLastWin32Error();
                    if(error!=259) throw new InvalidOperationException("Interface enumeration failed: "+error);
                    complete=true; break;
                }
                uint required; SetupDiGetDeviceInterfaceDetail(set,ref data,IntPtr.Zero,0,out required,IntPtr.Zero);
                if(required<8 || required>65536) throw new InvalidOperationException("Invalid detail length");
                IntPtr detail=Marshal.AllocHGlobal((int)required);
                try {
                    Marshal.WriteInt32(detail,8);
                    Check(SetupDiGetDeviceInterfaceDetail(set,ref data,detail,required,out required,IntPtr.Zero),"Interface detail");
                    string path=Marshal.PtrToStringUni(IntPtr.Add(detail,4));
                    if(Regex.IsMatch(path,@"(?i)^\\\\\?\\hid#vid_258a&pid_010c&mi_01&col06#")) paths.Add(path);
                } finally { Marshal.FreeHGlobal(detail); }
            }
        } finally { SetupDiDestroyDeviceInfoList(set); }
        if(!complete || paths.Count!=1) throw new InvalidOperationException("Expected exactly one target collection and complete enumeration; found "+paths.Count);
        // Zero desired access is sufficient for HID feature APIs; no input/output report access requested.
        using(var handle=CreateFile(paths[0],0,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
            Check(!handle.IsInvalid,"Open filtered collection");
            IntPtr pp; Check(HidD_GetPreparsedData(handle,out pp),"Preparsed data");
            try {
                Caps caps; if(HidP_GetCaps(pp,out caps)!=0x00110000) throw new InvalidOperationException("Caps failed");
                if(caps.UsagePage!=0xff00 || caps.Usage!=1 || caps.FeatureReportByteLength!=520 || caps.InputReportByteLength!=8 || caps.NumberFeatureValueCaps!=1 || caps.NumberFeatureButtonCaps!=0) throw new InvalidOperationException("Unexpected HID capabilities");
                var values=new ValueCaps[1]; ushort length=1;
                if(HidP_GetValueCaps(2,values,ref length,pp)!=0x00110000 || length!=1 || values[0].ReportID!=6) throw new InvalidOperationException("Unexpected feature report ID");
            } finally { HidD_FreePreparsedData(pp); }
            if(Process.GetProcessesByName("OemDrv").Length!=0) throw new InvalidOperationException("Official app reopened; aborting");
            var query=new byte[520]; byte[] header={6,0x84,0,0,1,0,128,0}; Array.Copy(header,query,8);
            var response=Query(handle);
            if(brightnessTest) {
                Match(response,expected);
                if(response[8+0x4e]!=9) throw new InvalidOperationException("Baseline is not brightness9");
                var restore=new byte[520]; Array.Copy(response,restore,136); restore[1]=4;
                var dim=(byte[])restore.Clone(); dim[8+0x4e]=8;
                string error=null; bool restoreAttempted=false; bool restored=false;
                byte[] dimRead=null; byte[] finalRead=null;
                try {
                    Check(HidD_SetFeature(handle,dim,520),"Brightness8 write");
                    Thread.Sleep(50);
                    dimRead=Query(handle);
                    var expectedDim=(byte[])response.Clone(); expectedDim[8+0x4e]=8;
                    Match(dimRead,expectedDim);
                    Thread.Sleep(10000);
                } catch(Exception e) { error=e.Message; }
                finally {
                    // Even a failed send could have applied: attempt baseline restoration once.
                    restoreAttempted=true;
                    try {
                        Check(HidD_SetFeature(handle,restore,520),"Restore brightness9");
                        Thread.Sleep(50);
                        finalRead=Query(handle); Match(finalRead,response); restored=true;
                    } catch(Exception e) { error=(error==null ? "" : error+"; ")+"RESTORATION: "+e.Message; }
                }
                return new { time=DateTimeOffset.Now.ToString("o"), baseline=response, dimWrite=dim, dimRead=dimRead, restoreWrite=restore, finalRead=finalRead, restoreAttempted=restoreAttempted, restored=restored, error=error, actualTransferLengthKnown=false };
            }
            return new { time=DateTimeOffset.Now.ToString("o"), target="VID258A PID010C MI01 COL06", setFeatureCalls=1, getFeatureCalls=1, query=query, response=response, responseBufferLength=response.Length, actualTransferLengthKnown=false, note="HidD_GetFeature returns success only, not actual byte count. Zero-initialized API buffer; validate complete header/config and zero tail offline. No configuration write." };
        }
    }
}
'@
Add-Type -TypeDefinition $source
$expected = [byte[]]@()
if ($BrightnessTest) {
    throw 'Historical brightness helper disabled after layout reset/replacement app. Establish fresh baseline and reviewed service before any new custom write.'
    $baseline = Get-Content 'D:\Projects\aula\docs\evidence\configuration-query-once.json' -Raw | ConvertFrom-Json
    $expected = [byte[]]$baseline.response
    if ($expected.Length -ne 520) { throw 'Baseline evidence length invalid' }
}
$result = [AulaOneQuery]::Run($BrightnessTest.IsPresent, $expected)
# Byte arrays are explicitly expanded as numbers, not PowerShell base64 strings.
$output = [ordered]@{}
foreach ($property in $result.PSObject.Properties) {
    $output[$property.Name] = $property.Value
    if ($property.Value -is [byte[]]) { $output[$property.Name] = [int[]]$property.Value }
}
$file = 'D:\Projects\aula\docs\evidence\configuration-query-once.json'
if ($BrightnessTest) { $file = 'D:\Projects\aula\docs\evidence\custom-brightness-test.json' }
$output | ConvertTo-Json -Depth 5 | Set-Content $file -Encoding utf8
if ($BrightnessTest -and (-not $result.restored -or $result.error)) { throw ('Brightness test failed: ' + $result.error) }
