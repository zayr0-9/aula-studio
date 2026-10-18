# Observation-only Windows media-key hook. No ordinary-key logging or suppression.
param([switch]$CompileCheck)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$source = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public sealed class MediaHookObserver : Form {
    delegate IntPtr HookCallback(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] struct KeyData {
        public uint VirtualKey, ScanCode, Flags, Time; public UIntPtr ExtraInfo;
    }
    [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetWindowsHookEx(int type,HookCallback callback,IntPtr module,uint thread);
    [DllImport("user32.dll",SetLastError=true)] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr GetModuleHandle(string name);
    readonly List<string> events=new List<string>();
    readonly Stopwatch clock=new Stopwatch();
    readonly Timer timer=new Timer();
    readonly HookCallback callback;
    IntPtr hook;
    string failure;
    bool overflow;
    public MediaHookObserver() {
        callback=OnHook;
        Text="Media-key hook observation - 30 seconds, pass-through";
        Width=690; Height=170;
        var label=new Label { Dock=DockStyle.Fill, Text="Observation only; volume/mute still operate.\r\n3 slow clockwise detents, pause, 3 counterclockwise, pause, 2 presses.\r\nOnly media keys are retained. Source device is NOT known to this hook.\r\nClose to stop early; automatic stop after 30 seconds." };
        Controls.Add(label);
        timer.Interval=100;
        timer.Tick+=delegate { if(clock.ElapsedMilliseconds>=30000) Close(); };
    }
    protected override void OnShown(EventArgs e) {
        base.OnShown(e);
        if(IntPtr.Size!=8 || Marshal.SizeOf(typeof(KeyData))!=24) { failure="Unexpected x64 ABI"; Close(); return; }
        hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
        if(hook==IntPtr.Zero) { failure="Hook registration failed: "+Marshal.GetLastWin32Error(); Close(); return; }
        clock.Start(); timer.Start();
    }
    IntPtr OnHook(int code,IntPtr message,IntPtr data) {
        if(code>=0) {
            // Inspect VK first; discard all ordinary keys without reading/storing their data.
            int key=Marshal.ReadInt32(data);
            if(key==0xad || key==0xae || key==0xaf) {
                if(events.Count<256) {
                    KeyData value=(KeyData)Marshal.PtrToStructure(data,typeof(KeyData));
                    events.Add(clock.ElapsedMilliseconds+" vk="+key.ToString("X2")+" scan="+value.ScanCode.ToString("X")+" flags="+value.Flags.ToString("X")+" message="+message.ToInt64().ToString("X"));
                } else overflow=true;
            }
        }
        // Always pass through, including negative codes and unrecognized events.
        return CallNextHookEx(hook,code,message,data);
    }
    protected override void OnFormClosed(FormClosedEventArgs e) {
        timer.Stop(); timer.Dispose();
        if(hook!=IntPtr.Zero) {
            if(!UnhookWindowsHookEx(hook)) failure="Hook cleanup failed: "+Marshal.GetLastWin32Error();
            hook=IntPtr.Zero;
        }
        base.OnFormClosed(e);
    }
    public static string[] Observe() {
        using(var observer=new MediaHookObserver()) {
            Application.Run(observer);
            if(observer.failure!=null) throw new InvalidOperationException(observer.failure);
            var result=new List<string>();
            result.Add("Pass-through global media-key observation only; no source identity; overflow="+observer.overflow);
            result.AddRange(observer.events);
            return result.ToArray();
        }
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
if ($CompileCheck) { 'Compile-only passed; no hook installed.'; exit 0 }
[MediaHookObserver]::Observe()
