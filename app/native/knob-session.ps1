# Opt-in only: GLOBAL volume/mute suppression; semantic input comes only from F75 COL02.
# The parent must continuously send "lease\n" and consume stdout. No elevation is needed.
param(
    [switch]$CompileCheck,
    [ValidateSet('media', 'scroll', 'zoom', 'tabs', 'history')]
    [string]$Profile = 'media'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$source = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
public sealed class KnobSession : Form {
    [StructLayout(LayoutKind.Sequential)] struct Registration {
        public ushort Page, Usage; public uint Flags; public IntPtr Window;
    }
    [StructLayout(LayoutKind.Sequential)] struct Header {
        public uint Type, Size; public IntPtr Device, WParam;
    }
    [StructLayout(LayoutKind.Sequential)] struct DeviceEntry { public IntPtr Device; public uint Type; }
    delegate IntPtr HookCallback(int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterRawInputDevices(Registration[] devices, uint count, uint size);
    [DllImport("user32.dll", SetLastError=true)] static extern uint GetRawInputData(IntPtr input, uint command, IntPtr data, ref uint size, uint headerSize);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern uint GetRawInputDeviceInfo(IntPtr device, uint command, IntPtr data, ref uint size);
    [DllImport("user32.dll", SetLastError=true)] static extern uint GetRawInputDeviceList(IntPtr list, ref uint count, uint size);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowsHookEx(int type, HookCallback callback, IntPtr module, uint thread);
    [DllImport("user32.dll", SetLastError=true)] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("hid.dll")] static extern int HidP_GetUsages(int reportType, ushort usagePage, ushort linkCollection, [Out] ushort[] usages, ref uint usageLength, IntPtr preparsed, byte[] report, uint reportLength);

    // x64 INPUT: DWORD type + alignment + 32-byte union. Both union members
    // carry our marker; no keyboard/mouse API is called by these pure builders.
    [StructLayout(LayoutKind.Sequential)] public struct KeyboardInput {
        public ushort Key, Scan; public uint Flags, Time; public UIntPtr ExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)] public struct MouseInput {
        public int X, Y; public uint Data, Flags, Time; public UIntPtr ExtraInfo;
    }
    [StructLayout(LayoutKind.Explicit)] public struct InputUnion {
        [FieldOffset(0)] public KeyboardInput Keyboard;
        [FieldOffset(0)] public MouseInput Mouse;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Input {
        public uint Type; public InputUnion Value;
    }
    public const ulong InjectionMarker = 0x41554c414b4e4f42UL;
    public enum ActionProfile { Media, Scroll, Zoom, Tabs, History }
    public static ActionProfile ParseProfile(string value) {
        switch (value) {
            case "media": return ActionProfile.Media;
            case "scroll": return ActionProfile.Scroll;
            case "zoom": return ActionProfile.Zoom;
            case "tabs": return ActionProfile.Tabs;
            case "history": return ActionProfile.History;
            default: throw new ArgumentException("Unsupported knob profile");
        }
    }
    public static string ProfileName(ActionProfile value) {
        switch (value) {
            case ActionProfile.Media: return "media";
            case ActionProfile.Scroll: return "scroll";
            case ActionProfile.Zoom: return "zoom";
            case ActionProfile.Tabs: return "tabs";
            case ActionProfile.History: return "history";
            default: throw new ArgumentException("Unsupported knob profile");
        }
    }
    public enum ParentCommand { None, Invalid, Lease, Stop, Profile }
    // Pure, fixed-size stream parser shared by the stdin reader and offline tests.
    public sealed class CommandParser {
        public const int MaxLength = 15;
        readonly char[] buffer = new char[MaxLength];
        int length;
        bool carriage, ended;
        public ActionProfile Profile { get; private set; }
        public ParentCommand Read(int value) {
            if (ended) return ParentCommand.Invalid;
            if (value < 0 || value > char.MaxValue) { ended = true; return ParentCommand.Invalid; }
            if (value == '\n') {
                string text = new string(buffer, 0, length);
                length = 0; carriage = false;
                switch (text) {
                    case "lease": return ParentCommand.Lease;
                    case "stop": ended = true; return ParentCommand.Stop;
                    case "profile:media": case "profile:scroll": case "profile:zoom":
                    case "profile:tabs": case "profile:history":
                        Profile = ParseProfile(text.Substring(8));
                        return ParentCommand.Profile;
                    default: ended = true; return ParentCommand.Invalid;
                }
            }
            if (value == '\r' && !carriage) { carriage = true; return ParentCommand.None; }
            if (carriage || length == buffer.Length) { ended = true; return ParentCommand.Invalid; }
            buffer[length++] = (char)value;
            return ParentCommand.None;
        }
    }
    public static bool BypassHook(uint flags, ulong extraInfo) {
        return (flags & 0x10) != 0 && extraInfo == InjectionMarker;
    }
    static Input Key(ushort key, bool release) {
        return new Input { Type=1, Value=new InputUnion { Keyboard=new KeyboardInput {
            Key=key, Flags=release ? 2U : 0U, ExtraInfo=new UIntPtr(InjectionMarker)
        } } };
    }
    static Input Mouse(uint flags, uint data) {
        return new Input { Type=0, Value=new InputUnion { Mouse=new MouseInput {
            Flags=flags, Data=data, ExtraInfo=new UIntPtr(InjectionMarker)
        } } };
    }
    public static Input[] BuildAction(ActionProfile profile, string semantic) {
        int direction;
        switch (semantic) {
            case "clockwise": direction=0; break;
            case "counterclockwise": direction=1; break;
            case "press": direction=2; break;
            default: throw new ArgumentException("Unsupported knob event");
        }
        ushort key; bool control=false, shift=false;
        switch (profile) {
            case ActionProfile.Media: key = direction == 0 ? (ushort)0xaf : direction == 1 ? (ushort)0xae : (ushort)0xb3; break;
            case ActionProfile.Scroll:
                if (direction == 2) return new Input[] { Mouse(0x20, 0), Mouse(0x40, 0) };
                return new Input[] { Mouse(0x800, unchecked((uint)(direction == 0 ? -120 : 120))) };
            case ActionProfile.Zoom:
                control=true; key=direction == 0 ? (ushort)0xbb : direction == 1 ? (ushort)0xbd : (ushort)0x30; break;
            case ActionProfile.Tabs:
                control=true; shift=direction == 1; key=direction == 2 ? (ushort)0x54 : (ushort)9; break;
            case ActionProfile.History:
                control=true; shift=direction == 2; key=direction == 0 ? (ushort)0x59 : (ushort)0x5a; break;
            default: throw new ArgumentException("Unsupported knob profile");
        }
        var batch = new List<Input>(6);
        if (control) batch.Add(Key(0x11, false));
        if (shift) batch.Add(Key(0x10, false));
        batch.Add(Key(key, false)); batch.Add(Key(key, true));
        if (shift) batch.Add(Key(0x10, true));
        if (control) batch.Add(Key(0x11, true));
        return batch.ToArray();
    }
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, Input[] inputs, int size);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    static bool ModifiersHeld() {
        // Do not release or borrow physical modifiers. Skip the whole action instead;
        // this also guards media/mouse actions against accidental OS/application chords.
        return (GetAsyncKeyState(0x10) & 0x8000) != 0 || (GetAsyncKeyState(0x11) & 0x8000) != 0 ||
            (GetAsyncKeyState(0x12) & 0x8000) != 0 || (GetAsyncKeyState(0x5b) & 0x8000) != 0 ||
            (GetAsyncKeyState(0x5c) & 0x8000) != 0;
    }
    struct PendingAction { public string Semantic; public long Created; }
    readonly Queue<PendingAction> pending = new Queue<PendingAction>(256);
    ActionProfile profile;
    int pendingProfile = -1; // Reader publishes only; the UI thread owns profile and pending actions.
    long lastAction;
    static readonly long ActionInterval = (Stopwatch.Frequency + 29) / 30;
    static readonly long StaleTicks = Stopwatch.Frequency * 150L / 1000;
    readonly Dictionary<IntPtr, bool> accepted = new Dictionary<IntPtr, bool>();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly HookCallback callback;
    readonly long started = Stopwatch.GetTimestamp();
    // -1 is terminal: neither a late lease nor a racing reader can revive this session.
    long lease;
    long lastAlive;
    IntPtr hook, target, preparsed;
    bool registered, cleaned;
    bool upDown, downDown, muteDown;
    string failure;
    static readonly long LeaseTicks = Stopwatch.Frequency * 2500L / 1000;
    static readonly long SessionTicks = Stopwatch.Frequency * 900L;

    public KnobSession(string selectedProfile) {
        profile = ParseProfile(selectedProfile);
        lease = started; lastAlive = started;
        callback = OnHook;
        Text = "F75 interception ACTIVE — emergency Disable";
        Width = 680; Height = 210;
        var label = new Label { Dock=DockStyle.Fill, Text="Opt-in interception: ALL devices' volume up/down/mute are suppressed.\r\nOnly the F75 COL02 triggers the selected actions. No ordinary keys are captured.\r\nDisable or close this window to restore pass-through. Automatic limit: 15 minutes.\r\nParent lease loss restores pass-through after 2.5 seconds." };
        var disable = new Button { Dock=DockStyle.Bottom, Height=44, Text="Disable interception NOW" };
        disable.Click += delegate { Expire(); Close(); };
        Controls.Add(label); Controls.Add(disable);
        timer.Interval = 50;
        timer.Tick += Tick;
    }
    void Expire() { Interlocked.Exchange(ref lease, -1); }
    bool Live() {
        for (;;) {
            long previous = Interlocked.Read(ref lease);
            if (previous < 0) return false;
            long now = Stopwatch.GetTimestamp();
            if (now - previous < LeaseTicks && now - started < SessionTicks) return true;
            if (Interlocked.CompareExchange(ref lease, -1, previous) == previous) return false;
        }
    }
    void Renew() {
        for (;;) {
            long previous = Interlocked.Read(ref lease);
            if (previous < 0) return;
            long now = Stopwatch.GetTimestamp();
            if (now - previous >= LeaseTicks || now - started >= SessionTicks) { Live(); return; }
            if (Interlocked.CompareExchange(ref lease, now, previous) == previous) return;
        }
    }
    void ReadCommands() {
        // Fixed-size parser, not ReadLine: a malicious or broken parent cannot grow memory.
        var parser = new CommandParser();
        try {
            while (Interlocked.Read(ref lease) >= 0) {
                ParentCommand command = parser.Read(Console.In.Read());
                if (command == ParentCommand.Invalid || command == ParentCommand.Stop) { Expire(); return; }
                if (command == ParentCommand.Lease) Renew();
                else if (command == ParentCommand.Profile)
                    Interlocked.Exchange(ref pendingProfile, (int)parser.Profile);
            }
        } catch { Expire(); }
    }
    string DeviceName(IntPtr device) {
        uint chars = 0;
        if (GetRawInputDeviceInfo(device, 0x20000007, IntPtr.Zero, ref chars) == 0xffffffff || chars < 1 || chars > 4096)
            throw new InvalidOperationException("Device-name length failed");
        IntPtr name = Marshal.AllocHGlobal(checked((int)(chars + 1) * 2));
        try {
            uint capacity = chars;
            uint read = GetRawInputDeviceInfo(device, 0x20000007, name, ref capacity);
            if (read == 0xffffffff || capacity > chars || read > chars) throw new InvalidOperationException("Device-name read failed");
            return Marshal.PtrToStringUni(name, (int)read).TrimEnd('\0');
        } finally { Marshal.FreeHGlobal(name); }
    }
    bool IsTarget(IntPtr device) {
        bool known;
        if (accepted.TryGetValue(device, out known)) return known;
        if (accepted.Count >= 64) throw new InvalidOperationException("Device cache bound exceeded");
        // Exact proven observer prefix; never broaden to VID/PID or keyboard TLC alone.
        known = Regex.IsMatch(DeviceName(device), @"(?i)^\\\\\?\\HID#VID_258A&PID_010C&MI_01&COL02#");
        accepted.Add(device, known);
        return known;
    }
    void FindUniqueTarget() {
        uint count = 0; uint stride = (uint)Marshal.SizeOf(typeof(DeviceEntry));
        if (GetRawInputDeviceList(IntPtr.Zero, ref count, stride) == 0xffffffff || count < 1 || count > 1024)
            throw new InvalidOperationException("Device enumeration failed or exceeded bound");
        uint capacity = count;
        IntPtr list = Marshal.AllocHGlobal(checked((int)(count * stride)));
        try {
            uint found = GetRawInputDeviceList(list, ref count, stride);
            if (found == 0xffffffff || found > capacity) throw new InvalidOperationException("Device enumeration changed; retry session");
            int matches = 0;
            for (uint i = 0; i < found; i++) {
                DeviceEntry entry = (DeviceEntry)Marshal.PtrToStructure(IntPtr.Add(list, checked((int)(i * stride))), typeof(DeviceEntry));
                if (entry.Type == 2 && IsTarget(entry.Device)) { matches++; target = entry.Device; }
            }
            if (matches != 1) throw new InvalidOperationException("Exactly one F75 COL02 consumer device is required");
        } finally { Marshal.FreeHGlobal(list); }
        uint size = 0;
        if (GetRawInputDeviceInfo(target, 0x20000005, IntPtr.Zero, ref size) == 0xffffffff || size < 1 || size > 65536)
            throw new InvalidOperationException("HID descriptor size invalid");
        preparsed = Marshal.AllocHGlobal((int)size);
        uint available = size;
        uint result = GetRawInputDeviceInfo(target, 0x20000005, preparsed, ref available);
        if (result == 0xffffffff || result != size || available != size) throw new InvalidOperationException("HID descriptor read failed");
    }
    protected override void OnShown(EventArgs e) {
        base.OnShown(e);
        try {
            if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(Header)) != 24 || Marshal.SizeOf(typeof(Registration)) != 16 || Marshal.SizeOf(typeof(DeviceEntry)) != 16 || Marshal.SizeOf(typeof(Input)) != 40 || Marshal.OffsetOf(typeof(Input), "Value").ToInt32() != 8)
                throw new InvalidOperationException("Unexpected x64 ABI");
            var reader = new Thread(ReadCommands); reader.IsBackground = true; reader.Name = "F75 parent lease"; reader.Start();
            FindUniqueTarget();
            // Consumer Control only, INPUTSINK + DEVNOTIFY. Never register keyboard input.
            var registration = new Registration { Page=0x0c, Usage=1, Flags=0x2100, Window=Handle };
            if (!RegisterRawInputDevices(new Registration[] { registration }, 1, 16)) throw new InvalidOperationException("Raw Input registration failed");
            registered = true;
            if (!Live()) { Close(); return; }
            hook = SetWindowsHookEx(13, callback, GetModuleHandle(null), 0);
            if (hook == IntPtr.Zero) throw new InvalidOperationException("Media hook registration failed");
            if (!Live()) { Close(); return; }
            timer.Start();
            Emit("ready");
        } catch (Exception error) { Fail(error.Message); }
    }
    IntPtr OnHook(int code, IntPtr message, IntPtr data) {
        // No IO, queue, locks, allocations or ordinary-key retention. Check the lease on
        // EVERY callback, independently of a UI timer potentially blocked writing stdout.
        if (code >= 0 && Live()) {
            int key = Marshal.ReadInt32(data);
            if (key == 0xad || key == 0xae || key == 0xaf) {
                uint flags = unchecked((uint)Marshal.ReadInt32(data, 8));
                ulong extra = unchecked((ulong)Marshal.ReadInt64(data, 16));
                if (!BypassHook(flags, extra)) return new IntPtr(1);
            }
        }
        return CallNextHookEx(hook, code, message, data);
    }
    void Enqueue(string semantic) {
        if (pending.Count >= 256) {
            pending.Clear();
            throw new InvalidOperationException("Semantic queue overflow");
        }
        pending.Enqueue(new PendingAction { Semantic=semantic, Created=Stopwatch.GetTimestamp() });
    }
    void ReadInput(IntPtr input) {
        if (!Live()) return;
        uint size = 0;
        if (GetRawInputData(input, 0x10000003, IntPtr.Zero, ref size, 24) == 0xffffffff || size < 32 || size > 4096)
            throw new InvalidOperationException("Raw Input size invalid");
        IntPtr data = Marshal.AllocHGlobal((int)size);
        try {
            uint capacity = size;
            uint read = GetRawInputData(input, 0x10000003, data, ref capacity, 24);
            if (read != size || capacity != size) throw new InvalidOperationException("Raw Input read failed");
            Header header = (Header)Marshal.PtrToStructure(data, typeof(Header));
            if (header.Size != size || header.Type != 2) return;
            if (!IsTarget(header.Device)) return;
            if (header.Device != target) throw new InvalidOperationException("Target identity changed");
            uint reportSize = unchecked((uint)Marshal.ReadInt32(data, 24));
            uint count = unchecked((uint)Marshal.ReadInt32(data, 28));
            if (reportSize < 1 || reportSize > 256 || count < 1 || count > 128 || 32UL + (ulong)reportSize * count != size)
                throw new InvalidOperationException("Consumer report bounds invalid");
            byte[] report = new byte[reportSize];
            ushort[] usages = new ushort[128];
            for (uint i = 0; i < count; i++) {
                Marshal.Copy(IntPtr.Add(data, checked(32 + (int)(i * reportSize))), report, 0, report.Length);
                uint length = (uint)usages.Length;
                // Parse the actual device descriptor instead of guessing report byte offsets.
                int status = HidP_GetUsages(0, 0x0c, 0, usages, ref length, preparsed, report, reportSize);
                if (status != 0x00110000 || length > usages.Length) throw new InvalidOperationException("Consumer usage parsing failed");
                bool up = false, down = false, mute = false;
                for (int j = 0; j < length; j++) {
                    up |= usages[j] == 0xe9; down |= usages[j] == 0xea; mute |= usages[j] == 0xe2;
                }
                if (up && !upDown) Enqueue("clockwise");
                if (down && !downDown) Enqueue("counterclockwise");
                if (mute && !muteDown) Enqueue("press");
                upDown = up; downDown = down; muteDown = mute;
            }
        } finally { Marshal.FreeHGlobal(data); }
    }
    protected override void WndProc(ref Message message) {
        if (registered) {
            try {
                if (message.Msg == 0x00fe) {
                    // Registration can announce already-present devices. Do not treat
                    // those initial GIDC_ARRIVAL messages as disconnection.
                    if (message.WParam.ToInt64() == 2) {
                        accepted.Clear(); Expire(); Close();
                    } else if (message.WParam.ToInt64() == 1 && message.LParam != target) {
                        accepted.Remove(message.LParam);
                        if (IsTarget(message.LParam)) { Expire(); Close(); }
                    }
                } else if (message.Msg == 0x00ff) ReadInput(message.LParam);
            } catch (Exception error) { Fail(error.Message); }
        }
        // Required WM_INPUT cleanup, including ignored devices.
        base.WndProc(ref message);
    }
    static void Emit(string value) {
        Console.Out.WriteLine("{\"event\":\"" + value + "\"}"); Console.Out.Flush();
    }
    void Tick(object sender, EventArgs args) {
        try {
            if (!Live()) { Close(); return; }
            int selected = Interlocked.Exchange(ref pendingProfile, -1);
            if (selected >= 0) {
                // Never reinterpret queued detents under the newly selected profile.
                pending.Clear();
                if (!Live()) { Close(); return; }
                profile = (ActionProfile)selected;
                Emit("profile:" + ProfileName(profile));
            }
            long now = Stopwatch.GetTimestamp();
            if (now - lastAlive >= Stopwatch.Frequency / 2) {
                Emit("alive"); lastAlive = now;
            }
            // One complete action per tick, never a catch-up burst. Under overload
            // discard the backlog rather than replaying stale navigation later.
            if (pending.Count != 0) {
                PendingAction action = pending.Dequeue();
                pending.Clear();
                now = Stopwatch.GetTimestamp();
                if (!Live()) { Close(); return; }
                if (now - action.Created > StaleTicks || now - lastAction < ActionInterval) return;
                if (ModifiersHeld()) return;
                Input[] batch = BuildAction(profile, action.Semantic);
                if (!Live()) { Close(); return; }
                lastAction = Stopwatch.GetTimestamp();
                if (SendInput((uint)batch.Length, batch, 40) != batch.Length)
                    throw new InvalidOperationException("Input injection failed or was partial; session stopped without retry");
                Emit(action.Semantic);
            }
        } catch (Exception error) { Fail(error.Message); }
    }
    void Fail(string message) { failure = message; Expire(); Close(); }
    protected override void OnFormClosing(FormClosingEventArgs e) {
        Expire(); Cleanup(); base.OnFormClosing(e);
    }
    void Cleanup() {
        if (cleaned) return;
        cleaned = true; Expire(); timer.Stop(); pending.Clear(); accepted.Clear();
        if (hook != IntPtr.Zero) {
            if (!UnhookWindowsHookEx(hook)) failure = "Hook cleanup failed";
            hook = IntPtr.Zero;
        }
        if (registered) {
            var remove = new Registration { Page=0x0c, Usage=1, Flags=1, Window=IntPtr.Zero };
            if (!RegisterRawInputDevices(new Registration[] { remove }, 1, 16)) failure = "Raw Input cleanup failed";
            registered = false;
        }
        if (preparsed != IntPtr.Zero) { Marshal.FreeHGlobal(preparsed); preparsed = IntPtr.Zero; }
    }
    protected override void Dispose(bool disposing) {
        if (disposing) { Cleanup(); timer.Dispose(); }
        base.Dispose(disposing);
    }
    public static void Run(string profile) {
        ParseProfile(profile);
        if (new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))
            throw new InvalidOperationException("Run this opt-in session non-elevated");
        bool created;
        using (var mutex = new Mutex(true, @"Local\Aula.F75.KnobSession", out created)) {
            if (!created) throw new InvalidOperationException("Another knob session already exists");
            try {
                using (var session = new KnobSession(profile)) {
                    Application.Run(session);
                    if (session.failure != null) throw new InvalidOperationException(session.failure);
                }
            } finally { mutex.ReleaseMutex(); }
        }
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
if ($CompileCheck) { 'Compile-only passed; no device enumeration, registration or hook.'; exit 0 }
[KnobSession]::Run($Profile)
