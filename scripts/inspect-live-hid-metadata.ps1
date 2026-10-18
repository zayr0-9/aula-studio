# Metadata only: no report I/O, serial-string reads, driver writes, or elevation.
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
public static class AulaMetadataOnly {
    [StructLayout(LayoutKind.Sequential)] public struct InterfaceData {
        public uint Size; public Guid ClassGuid; public uint Flags; public IntPtr Reserved;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Caps {
        public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst=17)] public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputDataIndices;
        public ushort NumberOutputButtonCaps, NumberOutputValueCaps, NumberOutputDataIndices;
        public ushort NumberFeatureButtonCaps, NumberFeatureValueCaps, NumberFeatureDataIndices;
    }
    // Native HIDP_BUTTON_CAPS and HIDP_VALUE_CAPS are each 72 bytes. Both
    // unions begin at 56. For nonranges UnionUsageLast is reserved, not usage.
    [StructLayout(LayoutKind.Explicit, Size=72)] public struct ButtonCaps {
        [FieldOffset(0)] public ushort UsagePage;
        [FieldOffset(2)] public byte ReportID;
        [FieldOffset(12)] public byte IsRange;
        [FieldOffset(56)] public ushort UsageFirst;
        [FieldOffset(58)] public ushort UsageLast;
    }
    [StructLayout(LayoutKind.Explicit, Size=72)] public struct ValueCaps {
        [FieldOffset(0)] public ushort UsagePage;
        [FieldOffset(2)] public byte ReportID;
        [FieldOffset(12)] public byte IsRange;
        [FieldOffset(16)] public byte HasNull;
        [FieldOffset(18)] public ushort BitSize;
        [FieldOffset(20)] public ushort ReportCount;
        [FieldOffset(32)] public uint UnitsExp;
        [FieldOffset(36)] public uint Units;
        [FieldOffset(40)] public int LogicalMin;
        [FieldOffset(44)] public int LogicalMax;
        [FieldOffset(48)] public int PhysicalMin;
        [FieldOffset(52)] public int PhysicalMax;
        [FieldOffset(56)] public ushort UsageFirst;
        [FieldOffset(58)] public ushort UsageLast;
    }
    [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid guid);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid guid, IntPtr enumerator, IntPtr parent, uint flags);
    [DllImport("setupapi.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr device, ref Guid guid, uint index, ref InterfaceData data);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref InterfaceData data, IntPtr detail, uint size, out uint required, IntPtr device);
    [DllImport("setupapi.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFile(string path, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_GetPreparsedData(SafeFileHandle handle, out IntPtr data);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_FreePreparsedData(IntPtr data);
    [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr data, out Caps caps);
    [DllImport("hid.dll")] static extern int HidP_GetButtonCaps(int type, [Out] ButtonCaps[] caps, ref ushort length, IntPtr data);
    [DllImport("hid.dll")] static extern int HidP_GetValueCaps(int type, [Out] ValueCaps[] caps, ref ushort length, IntPtr data);
    static Dictionary<string,object> Obj(params object[] pairs) {
        var d = new Dictionary<string,object>(); for(int i=0;i<pairs.Length;i+=2) d[(string)pairs[i]]=pairs[i+1]; return d;
    }
    static string Status(int code) { return "0x"+unchecked((uint)code).ToString("X8"); }
    static void Failure(List<object> errors, string operation, int code, string kind) { errors.Add(Obj("operation",operation,"code",kind=="NTSTATUS" ? (object)Status(code) : code,"kind",kind)); }
    static string Redact(string path) {
        var mi = Regex.Match(path, @"(?i)mi_[0-9a-f]{2}");
        var col = Regex.Match(path, @"(?i)col[0-9a-f]{2}");
        return @"\\?\hid#vid_258a&pid_010c"+(mi.Success ? "&"+mi.Value.ToLowerInvariant() : "")+(col.Success ? "&"+col.Value.ToLowerInvariant() : "")+"#[REDACTED]";
    }
    static object ReportCaps(IntPtr pp, int type, ushort buttons, ushort values, List<object> errors) {
        var records = new List<object>(); var ids = new SortedSet<byte>();
        if(buttons>0) {
            var a = new ButtonCaps[buttons]; ushort count=buttons; int status=HidP_GetButtonCaps(type,a,ref count,pp);
            if(status!=0x00110000) Failure(errors,"HidP_GetButtonCaps/"+type,status,"NTSTATUS");
            else for(int i=0;i<Math.Min((int)count,a.Length);i++) { var c=a[i]; ids.Add(c.ReportID); records.Add(Obj("kind","button","reportID",c.ReportID,"usagePage",c.UsagePage,"isRange",c.IsRange!=0,"usageFirst",c.UsageFirst,"usageLast",c.IsRange!=0 ? (object)c.UsageLast : null)); }
        }
        if(values>0) {
            var a = new ValueCaps[values]; ushort count=values; int status=HidP_GetValueCaps(type,a,ref count,pp);
            if(status!=0x00110000) Failure(errors,"HidP_GetValueCaps/"+type,status,"NTSTATUS");
            else for(int i=0;i<Math.Min((int)count,a.Length);i++) { var c=a[i]; ids.Add(c.ReportID); records.Add(Obj("kind","value","reportID",c.ReportID,"usagePage",c.UsagePage,"isRange",c.IsRange!=0,"usageFirst",c.UsageFirst,"usageLast",c.IsRange!=0 ? (object)c.UsageLast : null,"bitSize",c.BitSize,"reportCount",c.ReportCount)); }
        }
        return Obj("buttonCapCount",buttons,"valueCapCount",values,"reportIDs",new List<byte>(ids),"caps",records);
    }
    public static object Inspect() {
        int interfaceSize=Marshal.SizeOf(typeof(InterfaceData));
        var layout=Obj("pointerBytes",IntPtr.Size,"interfaceDataBytes",interfaceSize,"capsBytes",Marshal.SizeOf(typeof(Caps)),"buttonCapsBytes",Marshal.SizeOf(typeof(ButtonCaps)),"valueCapsBytes",Marshal.SizeOf(typeof(ValueCaps)),"detailCbSize",IntPtr.Size==8 ? 8 : 6,"detailPathOffset",4,"capsFeatureCountOffset",Marshal.OffsetOf(typeof(Caps),"NumberFeatureButtonCaps").ToInt32(),"valueReportCountOffset",Marshal.OffsetOf(typeof(ValueCaps),"ReportCount").ToInt32(),"unionOffset",Marshal.OffsetOf(typeof(ValueCaps),"UsageFirst").ToInt32());
        if(interfaceSize!=(IntPtr.Size==8?32:28) || Marshal.SizeOf(typeof(Caps))!=64 || Marshal.OffsetOf(typeof(Caps),"NumberFeatureButtonCaps").ToInt32()!=58 || Marshal.SizeOf(typeof(ButtonCaps))!=72 || Marshal.SizeOf(typeof(ValueCaps))!=72 || Marshal.OffsetOf(typeof(ValueCaps),"ReportCount").ToInt32()!=20 || Marshal.OffsetOf(typeof(ValueCaps),"UsageFirst").ToInt32()!=56) throw new InvalidOperationException("Native layout verification failed");
        var errors=new List<object>(); var devices=new List<object>(); Guid guid; HidD_GetHidGuid(out guid);
        IntPtr set=SetupDiGetClassDevs(ref guid,IntPtr.Zero,IntPtr.Zero,0x12);
        if(set==new IntPtr(-1)) { Failure(errors,"SetupDiGetClassDevs",Marshal.GetLastWin32Error(),"Win32"); return Obj("layout",layout,"devices",devices,"errors",errors); }
        try {
            for(uint index=0;index<512;index++) {
                if(index==511) errors.Add(Obj("operation","enumeration","reason","Final bounded slot reached; completeness beyond 512 interfaces not established"));
                var data=new InterfaceData(); data.Size=(uint)interfaceSize;
                if(!SetupDiEnumDeviceInterfaces(set,IntPtr.Zero,ref guid,index,ref data)) { int e=Marshal.GetLastWin32Error(); if(e!=259) Failure(errors,"SetupDiEnumDeviceInterfaces",e,"Win32"); break; }
                uint required; SetupDiGetDeviceInterfaceDetail(set,ref data,IntPtr.Zero,0,out required,IntPtr.Zero);
                int sizeError=Marshal.GetLastWin32Error();
                if(sizeError!=122 || required<6 || required>65536) { Failure(errors,"SetupDiGetDeviceInterfaceDetail/size",sizeError,"Win32"); continue; }
                IntPtr detail=Marshal.AllocHGlobal((int)required);
                try {
                    Marshal.WriteInt32(detail,IntPtr.Size==8?8:6);
                    if(!SetupDiGetDeviceInterfaceDetail(set,ref data,detail,required,out required,IntPtr.Zero)) { Failure(errors,"SetupDiGetDeviceInterfaceDetail",Marshal.GetLastWin32Error(),"Win32"); continue; }
                    string path=Marshal.PtrToStringUni(IntPtr.Add(detail,4));
                    // Exact VID/PID token boundary check precedes EVERY CreateFile.
                    if(!Regex.IsMatch(path,@"(?i)(?:#|&)vid_258a&pid_010c(?=&|#)")) continue;
                    var deviceErrors=new List<object>(); var device=Obj("redactedPath",Redact(path),"errors",deviceErrors); devices.Add(device);
                    using(var handle=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)) {
                        if(handle.IsInvalid) { Failure(deviceErrors,"CreateFile",Marshal.GetLastWin32Error(),"Win32"); continue; }
                        IntPtr pp=IntPtr.Zero;
                        try {
                            if(!HidD_GetPreparsedData(handle,out pp)) { Failure(deviceErrors,"HidD_GetPreparsedData",Marshal.GetLastWin32Error(),"Win32"); continue; }
                            Caps caps; int status=HidP_GetCaps(pp,out caps);
                            if(status!=0x00110000) { Failure(deviceErrors,"HidP_GetCaps",status,"NTSTATUS"); continue; }
                            device["usagePage"]=caps.UsagePage; device["usage"]=caps.Usage;
                            device["inputReportByteLength"]=caps.InputReportByteLength; device["outputReportByteLength"]=caps.OutputReportByteLength; device["featureReportByteLength"]=caps.FeatureReportByteLength;
                            device["input"]=ReportCaps(pp,0,caps.NumberInputButtonCaps,caps.NumberInputValueCaps,deviceErrors);
                            device["output"]=ReportCaps(pp,1,caps.NumberOutputButtonCaps,caps.NumberOutputValueCaps,deviceErrors);
                            device["feature"]=ReportCaps(pp,2,caps.NumberFeatureButtonCaps,caps.NumberFeatureValueCaps,deviceErrors);
                        } finally { if(pp!=IntPtr.Zero && !HidD_FreePreparsedData(pp)) Failure(deviceErrors,"HidD_FreePreparsedData",Marshal.GetLastWin32Error(),"Win32"); }
                    }
                } finally { Marshal.FreeHGlobal(detail); }

            }
        } finally { if(!SetupDiDestroyDeviceInfoList(set)) Failure(errors,"SetupDiDestroyDeviceInfoList",Marshal.GetLastWin32Error(),"Win32"); }
        return Obj("capturedAtUtc",DateTime.UtcNow.ToString("o"),"access","metadata only; desiredAccess=0; share=READ|WRITE; OPEN_EXISTING","layout",layout,"devices",devices,"errors",errors);
    }
}
'@
Add-Type -TypeDefinition $source -Language CSharp
[AulaMetadataOnly]::Inspect() | ConvertTo-Json -Depth 14 -Compress
