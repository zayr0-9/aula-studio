# Observation only. Consumer-control Raw Input, no hooks, setters or event injection.
param([switch]$CompileCheck)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Forms;
public sealed class KnobObserver : Form {
    [StructLayout(LayoutKind.Sequential)] struct Registration {
        public ushort Page, Usage; public uint Flags; public IntPtr Window;
    }
    [StructLayout(LayoutKind.Sequential)] struct Header {
        public uint Type, Size; public IntPtr Device, WParam;
    }
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterRawInputDevices(Registration[] devices, uint count, uint size);
    [DllImport("user32.dll", SetLastError=true)] static extern uint GetRawInputData(IntPtr input, uint command, IntPtr data, ref uint size, uint headerSize);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern uint GetRawInputDeviceInfo(IntPtr device, uint command, IntPtr data, ref uint size);
    readonly List<string> events = new List<string>();
    readonly Dictionary<IntPtr, bool> accepted = new Dictionary<IntPtr, bool>();
    readonly Timer timer = new Timer();
    readonly System.Diagnostics.Stopwatch clock = new System.Diagnostics.Stopwatch();
    readonly Label display = new Label();
    bool registered;
    bool overflow;
    string failure;
    public KnobObserver() {
        Text = "F75 knob observation - 30 seconds, no suppression";
        Width = 680; Height = 180;
        display.Dock = DockStyle.Fill;
        display.Text = "Observe only: volume and mute will still operate.\r\nTurn clockwise, counterclockwise, then press.\r\nClose this window to stop early.";
        Controls.Add(display);
        timer.Interval = 100;
        timer.Tick += delegate { if (clock.ElapsedMilliseconds >= 30000) Close(); };
    }
    protected override void OnShown(EventArgs e) {
        base.OnShown(e);
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(Header)) != 24 || Marshal.SizeOf(typeof(Registration)) != 16) {
            failure = "Unexpected x64 ABI"; Close(); return;
        }
        // UsagePage Consumer (0C), Usage Consumer Control (01). Never register keyboard TLC.
        var device = new Registration { Page=0x0c, Usage=1, Flags=0x100, Window=Handle };
        if (!RegisterRawInputDevices(new Registration[] { device }, 1, 16)) {
            failure = "Raw Input registration failed: " + Marshal.GetLastWin32Error(); Close(); return;
        }
        registered = true; clock.Start(); timer.Start();
    }
    bool IsTarget(IntPtr device) {
        bool known;
        if (accepted.TryGetValue(device, out known)) return known;
        if (accepted.Count >= 64) throw new InvalidOperationException("Device cache bound exceeded");
        uint chars = 0;
        if (GetRawInputDeviceInfo(device, 0x20000007, IntPtr.Zero, ref chars) == 0xffffffff || chars < 1 || chars > 4096)
            throw new InvalidOperationException("Raw Input device-name length failed");
        IntPtr name = Marshal.AllocHGlobal(checked((int)(chars + 1) * 2));
        try {
            if (GetRawInputDeviceInfo(device, 0x20000007, name, ref chars) == 0xffffffff)
                throw new InvalidOperationException("Raw Input device-name failed");
            string path = Marshal.PtrToStringUni(name, (int)chars).TrimEnd('\0');
            known = Regex.IsMatch(path, @"(?i)^\\\\\?\\HID#VID_258A&PID_010C&MI_01&COL02#");
            accepted.Add(device, known);
            return known;
        } finally { Marshal.FreeHGlobal(name); }
    }
    void ReadInput(IntPtr input) {
        uint size=0;
        if (GetRawInputData(input,0x10000003,IntPtr.Zero,ref size,24)==0xffffffff || size<32 || size>4096)
            throw new InvalidOperationException("Raw Input size invalid");
        IntPtr data=Marshal.AllocHGlobal((int)size);
        try {
            uint capacity=size;
            uint read=GetRawInputData(input,0x10000003,data,ref capacity,24);
            if(read==0xffffffff || read!=size || capacity!=size) throw new InvalidOperationException("Raw Input read failed");
            Header header=(Header)Marshal.PtrToStructure(data,typeof(Header));
            if(header.Size!=size || header.Type!=2 || !IsTarget(header.Device)) return;
            uint reportSize=unchecked((uint)Marshal.ReadInt32(data,24));
            uint count=unchecked((uint)Marshal.ReadInt32(data,28));
            if(reportSize<1 || reportSize>256 || count<1 || count>128 || 32UL+(ulong)reportSize*count != size)
                throw new InvalidOperationException("Invalid consumer HID report bounds");
            for(uint i=0;i<count;i++) {
                if(events.Count>=256) { overflow=true; Close(); return; }
                byte[] bytes=new byte[reportSize];
                Marshal.Copy(IntPtr.Add(data,checked(32+(int)(i*reportSize))),bytes,0,bytes.Length);
                events.Add(clock.ElapsedMilliseconds.ToString(System.Globalization.CultureInfo.InvariantCulture)+" "+BitConverter.ToString(bytes));
            }
            display.Text="Observed F75 consumer reports: "+events.Count+"\r\nVolume/mute are not suppressed. Auto-stop after 30 seconds.";
        } finally { Marshal.FreeHGlobal(data); }
    }
    protected override void WndProc(ref Message message) {
        if(message.Msg==0x00ff && registered) {
            try { ReadInput(message.LParam); }
            catch(Exception e) { failure=e.Message; Close(); }
        }
        // Let Windows perform required WM_INPUT cleanup. No consumption/suppression hook.
        base.WndProc(ref message);
    }
    protected override void OnFormClosed(FormClosedEventArgs e) {
        timer.Stop(); timer.Dispose();
        if(registered) {
            var remove=new Registration { Page=0x0c, Usage=1, Flags=1, Window=IntPtr.Zero };
            if(!RegisterRawInputDevices(new Registration[] { remove },1,16)) failure="Raw Input unregister failed";
            registered=false;
        }
        base.OnFormClosed(e);
    }
    public static string[] Observe() {
        using(var observer=new KnobObserver()) {
            Application.Run(observer);
            if(observer.failure!=null) throw new InvalidOperationException(observer.failure);
            var output=new List<string>();
            output.Add("F75 MI01 COL02 consumer reports only; milliseconds and hex. No ordinary keyboard capture. Overflow="+observer.overflow);
            output.AddRange(observer.events);
            return output.ToArray();
        }
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
if ($CompileCheck) { 'Compile-only passed; no input registration or observation.'; exit 0 }
[KnobObserver]::Observe()
