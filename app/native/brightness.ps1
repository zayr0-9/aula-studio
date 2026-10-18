# Fixed, single-transaction transport. No saved configuration, retries or restoration.
param(
    [ValidateSet('Read', 'Set', 'ReadEffect', 'SetEffect', 'ReadSpeed', 'SetSpeed', 'SetEffectBrightness', 'ReadColor', 'SetColor', 'ReadPgUp', 'SetPgUp', 'ReadMappings', 'SetMapping', 'ReadIndicators', 'SetIndicator', 'CompileCheck')]
    [string]$Action = 'Read',
    [int]$Brightness = -1,
    [int]$Effect = -1,
    [int]$Speed = -1,
    [int]$Red = -1,
    [int]$Green = -1,
    [int]$Blue = -1,
    [int]$Colourful = -1,
    [string]$Key,
    [int]$PgUp = -1,
    [Alias('Source')]
    [string]$SourceKey,
    [string]$Target
)
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class AulaBrightnessTransport {
    public static bool ConfigurationWriteAttempted { get; private set; }
    [StructLayout(LayoutKind.Sequential)] struct InterfaceData {
        public uint Size; public Guid ClassGuid; public uint Flags; public IntPtr Reserved;
    }
    [StructLayout(LayoutKind.Sequential)] struct Attributes {
        public uint Size; public ushort VendorID, ProductID, VersionNumber;
    }
    [StructLayout(LayoutKind.Sequential)] struct Caps {
        public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst=17)] public ushort[] Reserved;
        public ushort NumberLinkCollectionNodes, NumberInputButtonCaps, NumberInputValueCaps, NumberInputIndices;
        public ushort NumberOutputButtonCaps, NumberOutputValueCaps, NumberOutputIndices;
        public ushort NumberFeatureButtonCaps, NumberFeatureValueCaps, NumberFeatureIndices;
    }
    [StructLayout(LayoutKind.Explicit, Size=72)] struct ValueCaps {
        [FieldOffset(2)] public byte ReportID;
    }
    [DllImport("hid.dll")] static extern void HidD_GetHidGuid(out Guid guid);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid guid, IntPtr enumerator, IntPtr parent, uint flags);
    [DllImport("setupapi.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr device, ref Guid guid, uint index, ref InterfaceData data);
    [DllImport("setupapi.dll", CharSet=CharSet.Unicode, SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref InterfaceData data, IntPtr detail, uint size, out uint required, IntPtr device);
    [DllImport("setupapi.dll")] [return: MarshalAs(UnmanagedType.Bool)] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFile(string path, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_GetAttributes(SafeFileHandle handle, ref Attributes attributes);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_GetPreparsedData(SafeFileHandle handle, out IntPtr data);
    [DllImport("hid.dll")] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_FreePreparsedData(IntPtr data);
    [DllImport("hid.dll")] static extern int HidP_GetCaps(IntPtr data, out Caps caps);
    [DllImport("hid.dll")] static extern int HidP_GetValueCaps(int type, [Out] ValueCaps[] caps, ref ushort length, IntPtr data);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_SetFeature(SafeFileHandle handle, byte[] report, int length);
    [DllImport("hid.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.U1)] static extern bool HidD_GetFeature(SafeFileHandle handle, [In,Out] byte[] report, int length);

    static void Check(bool success, string operation) {
        if (!success) throw new InvalidOperationException(operation + " failed, Win32=" + Marshal.GetLastWin32Error());
    }
    static void CheckOfficialApp() {
        Process[] processes = Process.GetProcessesByName("OemDrv");
        try {
            if (processes.Length != 0) throw new InvalidOperationException("Official application is running; aborting.");
        } finally {
            foreach (Process process in processes) process.Dispose();
        }
    }
    static string FindCollection() {
        Guid guid; HidD_GetHidGuid(out guid);
        IntPtr set = SetupDiGetClassDevs(ref guid, IntPtr.Zero, IntPtr.Zero, 0x12);
        if (set == new IntPtr(-1)) throw new InvalidOperationException("Device enumeration failed.");
        var paths = new List<string>();
        bool complete = false;
        try {
            for (uint index = 0; index < 512; index++) {
                var data = new InterfaceData(); data.Size = 32;
                if (!SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref guid, index, ref data)) {
                    int error = Marshal.GetLastWin32Error();
                    if (error != 259) throw new InvalidOperationException("Interface enumeration failed: " + error);
                    complete = true; break;
                }
                uint required;
                bool probe = SetupDiGetDeviceInterfaceDetail(set, ref data, IntPtr.Zero, 0, out required, IntPtr.Zero);
                int probeError = Marshal.GetLastWin32Error();
                if (probe || probeError != 122 || required < 8 || required > 65536)
                    throw new InvalidOperationException("Invalid interface detail length probe.");
                IntPtr detail = Marshal.AllocHGlobal((int)required);
                try {
                    Marshal.WriteInt32(detail, 8);
                    Check(SetupDiGetDeviceInterfaceDetail(set, ref data, detail, required, out required, IntPtr.Zero), "Interface detail");
                    string path = Marshal.PtrToStringUni(IntPtr.Add(detail, 4));
                    if (path != null && Regex.IsMatch(path, @"(?i)^\\\\\?\\hid#vid_258a&pid_010c&mi_01&col06#")) paths.Add(path);
                } finally { Marshal.FreeHGlobal(detail); }
            }
        } finally { SetupDiDestroyDeviceInfoList(set); }
        if (!complete || paths.Count != 1)
            throw new InvalidOperationException("Expected exactly one target collection and complete enumeration.");
        return paths[0];
    }
    static void VerifyCollection(SafeFileHandle handle) {
        var attributes = new Attributes(); attributes.Size = (uint)Marshal.SizeOf(typeof(Attributes));
        Check(HidD_GetAttributes(handle, ref attributes), "Device attributes");
        if (attributes.VendorID != 0x258a || attributes.ProductID != 0x010c)
            throw new InvalidOperationException("Unexpected device identity.");
        IntPtr pp; Check(HidD_GetPreparsedData(handle, out pp), "Preparsed data");
        try {
            Caps caps;
            if (HidP_GetCaps(pp, out caps) != 0x00110000) throw new InvalidOperationException("Caps failed.");
            if (caps.UsagePage != 0xff00 || caps.Usage != 1 || caps.FeatureReportByteLength != 520 ||
                caps.InputReportByteLength != 8 || caps.NumberFeatureValueCaps != 1 || caps.NumberFeatureButtonCaps != 0)
                throw new InvalidOperationException("Unexpected HID capabilities.");
            var values = new ValueCaps[1]; ushort length = 1;
            if (HidP_GetValueCaps(2, values, ref length, pp) != 0x00110000 || length != 1 || values[0].ReportID != 6)
                throw new InvalidOperationException("Unexpected feature report ID.");
        } finally { HidD_FreePreparsedData(pp); }
    }
    // Observed configuration offsets; never supplied by the renderer.
    static readonly Dictionary<int, int> BrightnessOffsets = new Dictionary<int, int> {
        { 1, 0x3a }, { 11, 0x4e }
    };
    static int BrightnessOffset(byte[] configuration) {
        int offset;
        if (!BrightnessOffsets.TryGetValue(configuration[18], out offset))
            throw new InvalidOperationException("Brightness is unsupported for the active effect.");
        return 8 + offset;
    }
    static byte[] WithBrightness(byte[] fresh, int brightness) {
        if (brightness < 0 || brightness > 9) throw new ArgumentException("Brightness must be 0..9.");
        int offset = BrightnessOffset(fresh);
        if (fresh[offset] > 9) throw new InvalidOperationException("Invalid brightness.");
        byte[] expected = (byte[])fresh.Clone();
        expected[offset] = (byte)brightness;
        return expected;
    }
    static byte[] WithEffectBrightness(byte[] fresh, int effect, int brightness) {
        if (effect != 1 && effect != 11) throw new ArgumentException("Effect must be 1 or 11 for combined brightness.");
        byte[] target = (byte[])fresh.Clone();
        target[18] = (byte)effect;
        return WithBrightness(target, brightness);
    }
    // Unknown ordinary effect selectors are valid readable state, not write targets.
    static void ValidateOrdinaryConfiguration(byte[] response) {
        if (response[8 + 0x7e] != 0x5a || response[8 + 0x7f] != 0xa5)
            throw new InvalidOperationException("Invalid configuration markers.");
        if (response[17] != 0)
            throw new InvalidOperationException("Custom mode is not supported for Studio transitions.");
    }
    static byte[] Query(SafeFileHandle handle) {
        byte[] header = { 6, 0x84, 0, 0, 1, 0, 128, 0 };
        var query = new byte[520]; Array.Copy(header, query, header.Length);
        CheckOfficialApp();
        Check(HidD_SetFeature(handle, query, query.Length), "Configuration query");
        Thread.Sleep(25);
        // Deliberately retain the established HidD_GetFeature ABI. It returns only bool,
        // not an actual transfer length: a short zero-suffixed transfer cannot be fully
        // distinguished from a full response. Start from zero and validate all fields
        // and padding; do not represent buffer capacity as an observed transfer length.
        var response = new byte[520]; response[0] = 6;
        CheckOfficialApp();
        Check(HidD_GetFeature(handle, response, response.Length), "Configuration response");
        for (int i = 0; i < header.Length; i++)
            if (response[i] != header[i]) throw new InvalidOperationException("Invalid response header.");
        for (int i = 136; i < response.Length; i++)
            if (response[i] != 0) throw new InvalidOperationException("Invalid response padding.");
        ValidateOrdinaryConfiguration(response);
        if (BrightnessOffsets.ContainsKey(response[18]) && response[BrightnessOffset(response)] > 9)
            throw new InvalidOperationException("Invalid brightness.");
        // Speed occupies only the high nibble; other modes may use it differently.
        if (response[18] == 11 && (response[8 + 0x4f] >> 4) > 4) throw new InvalidOperationException("Invalid speed.");
        return response;
    }
    // Fixed_on palette contract: marker is payload 506/507 (report 514/515),
    // NOT payload 510/511. Both the observed getter and official setter agree.
    static void ValidateFixedPalette(byte[] palette) {
        if (palette == null || palette.Length != 520) throw new ArgumentException("Invalid palette length.");
        byte[] header = { 6, 0x8a, 0, 0, 1, 0, 0, 2 };
        for (int i = 0; i < header.Length; i++)
            if (palette[i] != header[i]) throw new InvalidOperationException("Invalid palette header.");
        for (int i = 420; i < 512; i++) {
            byte expected = i == 506 ? (byte)0x5a : i == 507 ? (byte)0xa5 : (byte)0;
            if (palette[8 + i] != expected) throw new InvalidOperationException("Invalid observed palette tail.");
        }
    }
    static void ValidateFixedConfiguration(byte[] configuration) {
        if (configuration == null || configuration.Length != 520 || configuration[17] != 0 || configuration[18] != 1)
            throw new InvalidOperationException("Color requires ordinary Fixed_on mode (1).");
        int colourful = configuration[8 + 0x3b] & 0x0f;
        if (colourful != 0 && colourful != 7) throw new InvalidOperationException("Unsupported Fixed_on Colourful value.");
    }
    // Pure clone-only helpers permit hardware-free reflection tests.
    static byte[] WithFixedColorPalette(byte[] fresh, int r, int g, int b) {
        if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255)
            throw new ArgumentException("RGB must each be 0..255.");
        ValidateFixedPalette(fresh);
        byte[] expected = (byte[])fresh.Clone();
        expected[29] = (byte)r; expected[30] = (byte)g; expected[31] = (byte)b;
        return expected;
    }
    static byte[] WithFixedColourful(byte[] fresh, int colourful) {
        if (colourful != 0 && colourful != 1) throw new ArgumentException("Colourful must be 0 or 1.");
        ValidateFixedConfiguration(fresh);
        byte[] expected = (byte[])fresh.Clone();
        expected[8 + 0x3b] = (byte)((fresh[8 + 0x3b] & 0xf0) | (colourful == 1 ? 7 : 0));
        return expected;
    }
    static byte[] PaletteQuery(SafeFileHandle handle) {
        byte[] header = { 6, 0x8a, 0, 0, 1, 0, 0, 2 };
        var query = new byte[520]; Array.Copy(header, query, header.Length);
        CheckOfficialApp();
        Check(HidD_SetFeature(handle, query, query.Length), "Palette query");
        Thread.Sleep(25);
        // As with Query, success does not attest actual transferred length.
        var response = new byte[520]; response[0] = 6;
        CheckOfficialApp();
        Check(HidD_GetFeature(handle, response, response.Length), "Palette response");
        ValidateFixedPalette(response);
        return response;
    }
    static void VerifyPayload(byte[] actual, byte[] expected, int length, string kind) {
        for (int i = 0; i < length; i++)
            if (actual[8 + i] != expected[8 + i]) throw new InvalidOperationException(kind + " readback mismatch.");
    }
    static string ColorResult(byte[] configuration, byte[] palette) {
        return "{\"red\":" + palette[29] + ",\"green\":" + palette[30] + ",\"blue\":" + palette[31] +
            ",\"colourful\":" + ((configuration[8 + 0x3b] & 0x0f) == 7 ? "true" : "false") + "}";
    }
    public static string RunColor(bool write, int r, int g, int b, int colourful) {
        // Validate even direct C# callers before mutex acquisition or any device I/O.
        if (write) {
            if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || (colourful != 0 && colourful != 1))
                throw new ArgumentException("SetColor requires RGB 0..255 and Colourful 0 or 1.");
        } else if (r != -1 || g != -1 || b != -1 || colourful != -1) {
            throw new ArgumentException("ReadColor does not accept color parameters.");
        }
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(InterfaceData)) != 32 || Marshal.SizeOf(typeof(Caps)) != 64 ||
            Marshal.SizeOf(typeof(ValueCaps)) != 72 || Marshal.SizeOf(typeof(Attributes)) != 12)
            throw new InvalidOperationException("Unexpected ABI; 64-bit Windows is required.");
        using (var mutex = new Mutex(false, @"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) {
                    owned = true;
                    throw new InvalidOperationException("Previous transaction was interrupted; state uncertain. No operation performed.");
                }
                if (!owned) throw new InvalidOperationException("Another brightness transaction is active.");
                CheckOfficialApp();
                string path = FindCollection();
                CheckOfficialApp();
                using (var handle = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero)) {
                    Check(!handle.IsInvalid, "Open filtered collection");
                    VerifyCollection(handle);
                    byte[] fresh = Query(handle);
                    ValidateFixedConfiguration(fresh);
                    byte[] palette = PaletteQuery(handle);
                    // Refuse a mode/configuration change while obtaining the palette,
                    // before either setter can replay the earlier configuration.
                    byte[] current = Query(handle);
                    ValidateFixedConfiguration(current);
                    VerifyPayload(current, fresh, 128, "Configuration");
                    if (!write) return ColorResult(current, palette);
                    byte[] expectedConfiguration = WithFixedColourful(fresh, colourful);
                    byte[] expectedPalette = WithFixedColorPalette(palette, r, g, b);
                    byte[] configurationWrite = (byte[])expectedConfiguration.Clone(); configurationWrite[1] = 0x04;
                    CheckOfficialApp();
                    // Both writes are non-atomic. Any failure from this point is uncertain;
                    // never retry, normalize the reserved tail, or restore stale buffers.
                    ConfigurationWriteAttempted = true;
                    Check(HidD_SetFeature(handle, configurationWrite, configurationWrite.Length), "Color configuration write");
                    Thread.Sleep(50);
                    byte[] actualConfiguration = Query(handle);
                    ValidateFixedConfiguration(actualConfiguration);
                    VerifyPayload(actualConfiguration, expectedConfiguration, 128, "Configuration");
                    byte[] paletteWrite = (byte[])expectedPalette.Clone(); paletteWrite[1] = 0x0a;
                    CheckOfficialApp();
                    ConfigurationWriteAttempted = true;
                    Check(HidD_SetFeature(handle, paletteWrite, paletteWrite.Length), "Color palette write");
                    Thread.Sleep(50);
                    byte[] actualPalette = PaletteQuery(handle);
                    VerifyPayload(actualPalette, expectedPalette, 512, "Palette");
                    actualConfiguration = Query(handle);
                    ValidateFixedConfiguration(actualConfiguration);
                    VerifyPayload(actualConfiguration, expectedConfiguration, 128, "Configuration");
                    return ColorResult(actualConfiguration, actualPalette);
                }
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
    // Separate custom-mode path: never weaken ordinary Query/transition admission.
    static void ValidateIndicatorBlock(byte[] response, bool configuration, bool allowOrdinary = false) {
        if (response == null || response.Length != 520) throw new ArgumentException("Invalid indicator block length.");
        int length = configuration ? 128 : 384;
        byte[] header = { 6, configuration ? (byte)0x84 : (byte)0x86, 0, 0, 1, 0, (byte)(length & 255), (byte)(length >> 8) };
        for (int i = 0; i < 8; i++)
            if (response[i] != header[i]) throw new InvalidOperationException("Invalid indicator response header.");
        for (int i = 8 + length; i < response.Length; i++)
            if (response[i] != 0) throw new InvalidOperationException("Invalid indicator response padding.");
        if (configuration) {
            if (response[134] != 0x5a || response[135] != 0xa5)
                throw new InvalidOperationException("Invalid configuration markers.");
            if (allowOrdinary && response[17] == 0) return;
            if (response[17] != 1 || response[18] != 21 || response[67] != 0x40)
                throw new InvalidOperationException("Indicators require existing custom mode; no mode transition performed.");
        }
    }
    static byte[] IndicatorQuery(SafeFileHandle handle, bool configuration, bool allowOrdinary = false) {
        int length = configuration ? 128 : 384;
        var query = new byte[520];
        byte[] header = { 6, configuration ? (byte)0x84 : (byte)0x86, 0, 0, 1, 0, (byte)(length & 255), (byte)(length >> 8) };
        Array.Copy(header, query, 8);
        CheckOfficialApp();
        Check(HidD_SetFeature(handle, query, query.Length), "Indicator query");
        Thread.Sleep(25);
        // Bool-only API cannot independently attest transfer length or freshness.
        var response = new byte[520]; response[0] = 6;
        CheckOfficialApp();
        Check(HidD_GetFeature(handle, response, response.Length), "Indicator response");
        ValidateIndicatorBlock(response, configuration, allowOrdinary);
        return response;
    }
    static int IndicatorSlot(string key) {
        switch (key) {
            case "number1": return 7;
            case "number2": return 13;
            case "number3": return 19;
            case "number4": return 25;
            default: throw new ArgumentException("Key must be number1, number2, number3 or number4.");
        }
    }
    static byte[] WithIndicator(byte[] fresh, string key, int r, int g, int b) {
        int slot = IndicatorSlot(key);
        if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255)
            throw new ArgumentException("RGB must each be 0..255.");
        ValidateIndicatorBlock(fresh, false);
        byte[] expected = (byte[])fresh.Clone();
        expected[8 + slot] = (byte)r;
        expected[8 + 126 + slot] = (byte)g;
        expected[8 + 252 + slot] = (byte)b;
        // Includes opaque payload378..383; never normalize or replay a fixture.
        return expected;
    }
    static string IndicatorsResult(byte[] table) {
        ValidateIndicatorBlock(table, false);
        var result = new System.Text.StringBuilder("{");
        for (int digit = 1; digit <= 4; digit++) {
            int slot = 7 + (digit - 1) * 6;
            if (digit != 1) result.Append(',');
            result.Append("\"Digit").Append(digit).Append("\":{\"red\":").Append(table[8 + slot])
                .Append(",\"green\":").Append(table[134 + slot]).Append(",\"blue\":").Append(table[260 + slot]).Append('}');
        }
        return result.Append('}').ToString();
    }
    public static string RunIndicators(bool write, string key, int r, int g, int b) {
        if (write) {
            IndicatorSlot(key);
            if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255)
                throw new ArgumentException("SetIndicator requires RGB 0..255.");
        } else if (key != null || r != -1 || g != -1 || b != -1) {
            throw new ArgumentException("ReadIndicators accepts no key or RGB parameters.");
        }
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(InterfaceData)) != 32 || Marshal.SizeOf(typeof(Caps)) != 64 ||
            Marshal.SizeOf(typeof(ValueCaps)) != 72 || Marshal.SizeOf(typeof(Attributes)) != 12)
            throw new InvalidOperationException("Unexpected ABI; 64-bit Windows is required.");
        using (var mutex = new Mutex(false, @"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) {
                    owned = true;
                    throw new InvalidOperationException("Previous transaction was interrupted; state uncertain. No operation performed.");
                }
                if (!owned) throw new InvalidOperationException("Another brightness transaction is active.");
                CheckOfficialApp();
                string path = FindCollection();
                CheckOfficialApp();
                using (var handle = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero)) {
                    Check(!handle.IsInvalid, "Open filtered collection");
                    VerifyCollection(handle);
                    byte[] freshConfiguration = IndicatorQuery(handle, true);
                    byte[] table = IndicatorQuery(handle, false);
                    byte[] current = IndicatorQuery(handle, true);
                    VerifyPayload(current, freshConfiguration, 128, "Prewrite configuration");
                    if (!write) return IndicatorsResult(table);
                    byte[] expected = WithIndicator(table, key, r, g, b);
                    bool changed = false;
                    for (int i = 8; i < 392; i++) if (expected[i] != table[i]) changed = true;
                    if (!changed) return IndicatorsResult(table);
                    byte[] report = (byte[])expected.Clone(); report[1] = 0x06;
                    CheckOfficialApp();
                    ConfigurationWriteAttempted = true;
                    Check(HidD_SetFeature(handle, report, report.Length), "Static indicator write");
                    Thread.Sleep(500);
                    byte[] actual = IndicatorQuery(handle, false);
                    VerifyPayload(actual, expected, 384, "Static table");
                    byte[] actualConfiguration = IndicatorQuery(handle, true);
                    VerifyPayload(actualConfiguration, freshConfiguration, 128, "Configuration");
                    return IndicatorsResult(actual);
                }
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
    // Fixed semantic whitelist: physical identities from keyboard-layout.ts; usages
    // from matrix-layer0-20261018-103210.json. Home/Insert are standard HID usages.
    static readonly string[] MappingIds = ("Escape F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 " +
        "Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace Delete " +
        "Tab KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash PageUp " +
        "CapsLock KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Enter PageDown " +
        "KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash ArrowUp End Space ArrowLeft ArrowDown ArrowRight ControlLeft ShiftLeft MetaLeft AltLeft ControlRight ShiftRight Home Insert").Split(' ');
    static readonly int[] MappingSlots = {
        0,12,18,24,30,36,42,48,54,60,66,72,78,
        1,7,13,19,25,31,37,43,49,55,61,67,73,79,85,
        2,8,14,20,26,32,38,44,50,56,62,68,74,80,86,
        3,9,15,21,27,33,39,45,51,57,63,69,81,87,
        10,16,22,28,34,40,46,52,58,64,82,88,35,77,83,89,5,4,11,17,59,70
    };
    static readonly int[] MappingUsages = {
        41,58,59,60,61,62,63,64,65,66,67,68,69,
        53,30,31,32,33,34,35,36,37,38,39,45,46,42,76,
        43,20,26,8,21,23,28,24,12,18,19,47,48,49,75,
        57,4,22,7,9,10,11,13,14,15,51,52,40,78,
        29,27,6,25,5,17,16,54,55,56,82,77,44,80,81,79,0,0,0,0,0,0,74,73
    };
    static int MappingIndex(string id, bool source) {
        int i = Array.IndexOf(MappingIds, id);
        if (i < 0 || (source && i >= MappingSlots.Length)) throw new ArgumentException("Unsupported mapping identity.");
        return i;
    }
    // Modifier capture: slot7 Ctrl=[0,1,0,0], Ctrl+C=[0,1,0,6], Ctrl+Shift+C=[0,3,0,6].
    // Shortcut masks remain 0..3 only. Standalone extension: brightness-20261018-105439.pcap
    // frames249/251/253/255, payload differences only37/39 versus canonical 20261018-103210.
    static readonly string[] ModifierIds = { "ControlLeft", "ShiftLeft", "MetaLeft", "AltLeft", "ControlRight", "ShiftRight" };
    static readonly byte[] ModifierMasks = { 1, 2, 8, 4, 16, 32 };
    static void MappingEncoding(string target, out byte mask, out byte usage) {
        mask = 0;
        int modifier = Array.IndexOf(ModifierIds, target);
        if (modifier >= 0) { mask = ModifierMasks[modifier]; usage = 0; return; }
        string key = target;
        if (key != null && key.StartsWith("Ctrl+Shift+", StringComparison.Ordinal)) { mask = 3; key = key.Substring(11); }
        else if (key != null && key.StartsWith("Ctrl+", StringComparison.Ordinal)) { mask = 1; key = key.Substring(5); }
        else if (key != null && key.StartsWith("Shift+", StringComparison.Ordinal)) { mask = 2; key = key.Substring(6); }
        int index = MappingIndex(key, false);
        usage = (byte)MappingUsages[index];
        if (usage == 0) throw new ArgumentException("Shortcut requires an ordinary key.");
    }
    static string MappingTarget(byte[] fresh, int index) {
        int offset = 8 + 4 * MappingSlots[index];
        int mask = fresh[offset+1], usage = fresh[offset+3];
        if (fresh[offset] != 0 || fresh[offset+2] != 0) return null;
        if (usage == 0) {
            int modifier = Array.IndexOf(ModifierMasks, (byte)mask);
            return modifier < 0 ? null : ModifierIds[modifier];
        }
        if (mask > 3) return null;
        int target = Array.IndexOf(MappingUsages, usage);
        if (target < 0) return null;
        return (mask == 1 ? "Ctrl+" : mask == 2 ? "Shift+" : mask == 3 ? "Ctrl+Shift+" : "") + MappingIds[target];
    }
    static string MappingsJson(byte[] fresh) {
        ValidateMatrix(fresh);
        var result = new System.Text.StringBuilder("[");
        for (int i = 0; i < MappingSlots.Length; i++) {
            if (i != 0) result.Append(',');
            string target = MappingTarget(fresh, i);
            result.Append("{\"source\":\"").Append(MappingIds[i]).Append("\",\"target\":");
            if (target == null) result.Append("null");
            else result.Append('"').Append(target).Append('"');
            result.Append('}');
        }
        return result.Append(']').ToString();
    }
    static byte[] WithMapping(byte[] fresh, string source, string target) {
        int index = MappingIndex(source, true);
        byte mask, usage;
        MappingEncoding(target, out mask, out usage);
        ValidateMatrix(fresh);
        if (MappingTarget(fresh, index) == null) throw new InvalidOperationException("Source is not a supported key entry.");
        byte[] expected = (byte[])fresh.Clone();
        int offset = 8 + 4 * MappingSlots[index];
        expected[offset] = 0;
        expected[offset+1] = mask;
        expected[offset+2] = 0;
        expected[offset+3] = usage;
        return expected;
    }
    // Layer0 matrix is independent of the lighting configuration/palette contracts.
    static void ValidateMatrix(byte[] fresh) {
        if (fresh == null || fresh.Length != 520) throw new ArgumentException("Invalid matrix length.");
        byte[] header = { 6, 0x83, 0, 0, 1, 0, 0, 2 };
        for (int i = 0; i < header.Length; i++)
            if (fresh[i] != header[i]) throw new InvalidOperationException("Invalid matrix header.");
        if (fresh[516] != 0 || fresh[517] != 0 || fresh[518] != 0x5a || fresh[519] != 0xa5)
            throw new InvalidOperationException("Invalid matrix signature.");
    }
    static void ValidatePgUpMatrix(byte[] fresh) {
        ValidateMatrix(fresh);
        if (fresh[352] != 0 || fresh[353] != 0 || fresh[354] != 0 || (fresh[355] != 74 && fresh[355] != 75))
            throw new InvalidOperationException("PgUp slot must be an ordinary Home or PgUp entry.");
    }
    static byte[] WithPgUp(byte[] fresh, int usage) {
        if (usage != 74 && usage != 75) throw new ArgumentException("PgUp must be 74 (Home) or 75 (PgUp).");
        ValidatePgUpMatrix(fresh);
        byte[] expected = (byte[])fresh.Clone();
        expected[355] = (byte)usage;
        return expected;
    }
    static byte[] MatrixQuery(SafeFileHandle handle) {
        byte[] header = { 6, 0x83, 0, 0, 1, 0, 0, 2 };
        var query = new byte[520]; Array.Copy(header, query, header.Length);
        CheckOfficialApp();
        Check(HidD_SetFeature(handle, query, query.Length), "Layer0 matrix query");
        Thread.Sleep(25);
        // Fresh zero buffer. Established bool-only ABI cannot attest transfer length;
        // validate header, final signature and the restricted source entry instead.
        var response = new byte[520]; response[0] = 6;
        CheckOfficialApp();
        Check(HidD_GetFeature(handle, response, response.Length), "Layer0 matrix response");
        ValidateMatrix(response);
        return response;
    }
    public static int RunPgUp(bool write, int usage) {
        if (write ? (usage != 74 && usage != 75) : usage != -1)
            throw new ArgumentException("SetPgUp requires 74 or 75; ReadPgUp accepts no usage.");
        byte[] result = RunMatrix(write, null, null, usage);
        ValidatePgUpMatrix(result);
        return result[355];
    }
    public static string RunMappings(bool write, string source, string target) {
        if (write) { MappingIndex(source, true); byte mask, usage; MappingEncoding(target, out mask, out usage); }
        else if (!String.IsNullOrEmpty(source) || !String.IsNullOrEmpty(target)) throw new ArgumentException("ReadMappings accepts no identities.");
        return MappingsJson(RunMatrix(write, write ? source : null, write ? target : null, -1));
    }
    static byte[] RunMatrix(bool write, string source, string target, int pgUp) {
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(InterfaceData)) != 32 || Marshal.SizeOf(typeof(Caps)) != 64 ||
            Marshal.SizeOf(typeof(ValueCaps)) != 72 || Marshal.SizeOf(typeof(Attributes)) != 12)
            throw new InvalidOperationException("Unexpected ABI; 64-bit Windows is required.");
        using (var mutex = new Mutex(false, @"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) {
                    owned = true;
                    throw new InvalidOperationException("Previous transaction was interrupted; state uncertain. No operation performed.");
                }
                if (!owned) throw new InvalidOperationException("Another brightness transaction is active.");
                CheckOfficialApp();
                string path = FindCollection();
                CheckOfficialApp();
                using (var handle = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero)) {
                    Check(!handle.IsInvalid, "Open filtered collection");
                    VerifyCollection(handle);
                    byte[] fresh = MatrixQuery(handle);
                    if (source == null && target == null && pgUp != -1) ValidatePgUpMatrix(fresh);
                    if (!write) return fresh;
                    byte[] expected = source == null ? WithPgUp(fresh, pgUp) : WithMapping(fresh, source, target);
                    byte[] report = (byte[])expected.Clone(); report[1] = 0x03;
                    CheckOfficialApp();
                    ConfigurationWriteAttempted = true;
                    Check(HidD_SetFeature(handle, report, report.Length), "PgUp matrix write");
                    Thread.Sleep(50);
                    byte[] actual = MatrixQuery(handle);
                    VerifyPayload(actual, expected, 512, "Matrix");
                    return actual;
                }
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
    public static int Run(bool setBrightness, int brightness, bool effectOperation, int effect, bool speedOperation, int speed, int effectBrightness = -1) {
        if (effectBrightness < -1 || effectBrightness > 9)
            throw new ArgumentException("Combined brightness must be 0..9, or -1 for no combined operation.");
        if (effectBrightness != -1 && (!effectOperation || (effect != 1 && effect != 11) || speedOperation || speed != -1 || setBrightness || brightness != -1))
            throw new ArgumentException("Combined brightness requires effect 1 or 11 and no speed or standalone brightness operation.");
        if (speedOperation) {
            if (effectOperation || effect != -1 || setBrightness || brightness != -1)
                throw new ArgumentException("Effect and brightness are not accepted for speed operations.");
            if (speed < -1 || speed > 4) throw new ArgumentException("Speed must be 0..4, or -1 to read.");
        } else if (effectOperation) {
            if (speed != -1) throw new ArgumentException("Speed is accepted only for speed operations.");
            if (setBrightness || brightness != -1) throw new ArgumentException("Brightness is not accepted for effect operations.");
            if (effect != -1 && effect != 0 && effect != 1 && effect != 11 && effect != 17)
                throw new ArgumentException("Effect must be 0, 1, 11 or 17.");
        } else {
            if (speed != -1) throw new ArgumentException("Speed is accepted only for speed operations.");
            if (effect != -1) throw new ArgumentException("Effect is accepted only for effect operations.");
            if (setBrightness && (brightness < 0 || brightness > 9)) throw new ArgumentException("Brightness must be 0..9.");
            if (!setBrightness && brightness != -1) throw new ArgumentException("Brightness is accepted only for Set.");
        }
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(InterfaceData)) != 32 || Marshal.SizeOf(typeof(Caps)) != 64 ||
            Marshal.SizeOf(typeof(ValueCaps)) != 72 || Marshal.SizeOf(typeof(Attributes)) != 12)
            throw new InvalidOperationException("Unexpected ABI; 64-bit Windows is required.");
        // Global namespace coordinates helper instances across Windows sessions. Failure
        // to create/open the mutex is fatal, never a reason to run without exclusion.
        using (var mutex = new Mutex(false, @"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) {
                    owned = true;
                    throw new InvalidOperationException("Previous transaction was interrupted; state uncertain. No operation performed.");
                }
                if (!owned) throw new InvalidOperationException("Another brightness transaction is active.");
                CheckOfficialApp();
                string path = FindCollection();
                CheckOfficialApp();
                // Zero access suffices for the established HID feature APIs.
                using (var handle = CreateFile(path, 0, 3, IntPtr.Zero, 3, 0, IntPtr.Zero)) {
                    Check(!handle.IsInvalid, "Open filtered collection");
                    VerifyCollection(handle);
                    // Only metadata ReadEffect may admit the owner-observed custom tuple.
                    // Every setter and other ordinary reader retains strict Query refusal.
                    byte[] fresh = effectOperation && effect == -1 ? IndicatorQuery(handle, true, true) : Query(handle);
                    if (speedOperation) {
                        if (fresh[18] != 11) throw new InvalidOperationException("Speed requires Neon_stream mode (11).");
                        if (speed == -1) return fresh[8 + 0x4f] >> 4;
                    } else if (effectOperation) {
                        if (effect == -1) return fresh[18];
                    } else {
                        int offset = BrightnessOffset(fresh);
                        if (!setBrightness) return fresh[offset];
                    }
                    byte[] expected = (byte[])fresh.Clone();
                    if (speedOperation) expected[8 + 0x4f] = (byte)((fresh[8 + 0x4f] & 0x0f) | (speed << 4));
                    else if (effectOperation) {
                        if (effectBrightness != -1) expected = WithEffectBrightness(fresh, effect, effectBrightness);
                        else expected[8 + 0x0a] = (byte)effect;
                    }
                    else expected = WithBrightness(fresh, brightness);
                    byte[] write = (byte[])expected.Clone(); write[1] = 0x04;
                    CheckOfficialApp();
                    ConfigurationWriteAttempted = true;
                    Check(HidD_SetFeature(handle, write, write.Length), speedOperation ? "Speed write" : effectOperation ? "Effect write" : "Brightness write");
                    Thread.Sleep(50);
                    byte[] actual = Query(handle);
                    for (int i = 0; i < 128; i++)
                        if (actual[8 + i] != expected[8 + i]) throw new InvalidOperationException("Configuration readback mismatch.");
                    return speedOperation ? actual[8 + 0x4f] >> 4 : effectOperation ? actual[18] : actual[BrightnessOffset(actual)];
                }
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
}
'@
try {
    if ($Action -in @('ReadIndicators', 'SetIndicator')) {
        foreach ($name in $PSBoundParameters.Keys) {
            if ($name -ne 'Action' -and -not ($Action -eq 'SetIndicator' -and $name -in @('Key', 'Red', 'Green', 'Blue'))) {
                throw ($name + ' is not accepted for ' + $Action + '.')
            }
        }
        if ($Action -eq 'SetIndicator') {
            if (-not $PSBoundParameters.ContainsKey('Key') -or $Key -cnotin @('number1', 'number2', 'number3', 'number4')) {
                throw 'SetIndicator requires Key number1, number2, number3 or number4.'
            }
        }
    } elseif ($PSBoundParameters.ContainsKey('Key')) {
        throw 'Key is accepted only for SetIndicator.'
    }
    if ($Action -in @('ReadMappings', 'SetMapping')) {
        foreach ($name in $PSBoundParameters.Keys) {
            if ($name -ne 'Action' -and -not ($Action -eq 'SetMapping' -and $name -in @('SourceKey', 'Target'))) {
                throw ($name + ' is not accepted for ' + $Action + '.')
            }
        }
        if ($Action -eq 'SetMapping' -and (-not $PSBoundParameters.ContainsKey('SourceKey') -or -not $PSBoundParameters.ContainsKey('Target'))) {
            throw 'SetMapping requires Source and Target.'
        }
    } elseif ($PSBoundParameters.ContainsKey('SourceKey') -or $PSBoundParameters.ContainsKey('Target')) {
        throw 'Source and Target are accepted only for SetMapping.'
    }
    if ($Action -in @('ReadPgUp', 'SetPgUp')) {
        foreach ($name in $PSBoundParameters.Keys) {
            if ($name -ne 'Action' -and -not ($Action -eq 'SetPgUp' -and $name -eq 'PgUp')) {
                throw ($name + ' is not accepted for ' + $Action + '.')
            }
        }
    }
    if ($Action -eq 'SetPgUp') {
        if (-not $PSBoundParameters.ContainsKey('PgUp') -or $PgUp -notin @(74, 75)) {
            throw 'SetPgUp requires PgUp 74 (Home) or 75 (PgUp).'
        }
    } elseif ($PSBoundParameters.ContainsKey('PgUp')) {
        throw 'PgUp is accepted only for SetPgUp.'
    }
    foreach ($name in @('Red', 'Green', 'Blue', 'Colourful')) {
        if ($PSBoundParameters.ContainsKey($name) -and $Action -ne 'SetColor' -and -not ($Action -eq 'SetIndicator' -and $name -ne 'Colourful')) {
            throw ($name + ' is accepted only for SetColor.')
        }
    }
    if ($Action -in @('SetColor', 'SetIndicator')) {
        foreach ($name in @('Red', 'Green', 'Blue')) {
            $value = Get-Variable -Name $name -ValueOnly
            if (-not $PSBoundParameters.ContainsKey($name) -or $value -lt 0 -or $value -gt 255) {
                throw ($Action + ' requires Red, Green and Blue 0..255.')
            }
        }
        if ($Action -eq 'SetColor' -and (-not $PSBoundParameters.ContainsKey('Colourful') -or $Colourful -notin @(0, 1))) {
            throw 'SetColor requires Colourful 0 or 1.'
        }
    }
    if ($Action -eq 'SetEffectBrightness') {
        if (-not $PSBoundParameters.ContainsKey('Brightness') -or $Brightness -lt 0 -or $Brightness -gt 9) { throw 'SetEffectBrightness requires Brightness 0..9.' }
        if (-not $PSBoundParameters.ContainsKey('Effect') -or $Effect -notin @(1, 11)) { throw 'SetEffectBrightness requires Effect 1 or 11.' }
    }
    if ($Action -in @('Set', 'SetEffectBrightness')) {
        if ($Brightness -lt 0 -or $Brightness -gt 9) { throw 'Set requires Brightness 0..9.' }
    } elseif ($PSBoundParameters.ContainsKey('Brightness')) {
        throw 'Brightness is accepted only for Set.'
    }
    if ($Action -eq 'SetEffect') {
        if ($Effect -notin @(0, 1, 11, 17)) { throw 'SetEffect requires Effect 0, 1, 11 or 17.' }
    } elseif ($Action -ne 'SetEffectBrightness' -and $PSBoundParameters.ContainsKey('Effect')) {
        throw 'Effect is accepted only for SetEffect.'
    }
    if ($Action -eq 'SetSpeed') {
        if ($Speed -lt 0 -or $Speed -gt 4) { throw 'SetSpeed requires Speed 0..4.' }
    } elseif ($PSBoundParameters.ContainsKey('Speed')) {
        throw 'Speed is accepted only for SetSpeed.'
    }
    Add-Type -TypeDefinition $source -ErrorAction Stop
    # Compilation only: do not acquire the mutex, enumerate, open or query hardware.
    if ($Action -eq 'CompileCheck') { exit 0 }
    if ($Action -in @('ReadIndicators', 'SetIndicator')) {
        $indicatorKey = if ($Action -eq 'SetIndicator') { $Key } else { $null }
        [Console]::Out.WriteLine([AulaBrightnessTransport]::RunIndicators(($Action -eq 'SetIndicator'), $indicatorKey, $Red, $Green, $Blue))
        exit 0
    }
    if ($Action -in @('ReadColor', 'SetColor')) {
        $result = [AulaBrightnessTransport]::RunColor(($Action -eq 'SetColor'), $Red, $Green, $Blue, $Colourful)
        [Console]::Out.WriteLine($result)
        exit 0
    }
    if ($Action -in @('ReadMappings', 'SetMapping')) {
        $mappingSource = if ($Action -eq 'SetMapping') { $SourceKey } else { $null }
        $mappingTarget = if ($Action -eq 'SetMapping') { $Target } else { $null }
        [Console]::Out.WriteLine([AulaBrightnessTransport]::RunMappings(($Action -eq 'SetMapping'), $mappingSource, $mappingTarget))
        exit 0
    }
    if ($Action -in @('ReadPgUp', 'SetPgUp')) {
        $result = [AulaBrightnessTransport]::RunPgUp(($Action -eq 'SetPgUp'), $PgUp)
        [Console]::Out.WriteLine($result.ToString([System.Globalization.CultureInfo]::InvariantCulture))
        exit 0
    }
    $effectBrightness = -1
    $standaloneBrightness = $Brightness
    if ($Action -eq 'SetEffectBrightness') {
        $effectBrightness = $Brightness
        $standaloneBrightness = -1
    }
    $result = [AulaBrightnessTransport]::Run(($Action -eq 'Set'), $standaloneBrightness, ($Action -in @('ReadEffect', 'SetEffect', 'SetEffectBrightness')), $Effect, ($Action -in @('ReadSpeed', 'SetSpeed')), $Speed, $effectBrightness)
    # A JSON integer is the entire success output; no device paths or report contents.
    [Console]::Out.WriteLine($result.ToString([System.Globalization.CultureInfo]::InvariantCulture))
    exit 0
} catch {
    $message = $_.Exception.GetBaseException().Message
    if (('AulaBrightnessTransport' -as [type]) -and [AulaBrightnessTransport]::ConfigurationWriteAttempted) {
        $writeKind = if ($Action -eq 'SetIndicator') { 'Static indicator' } elseif ($Action -in @('SetPgUp', 'SetMapping')) { 'Key matrix' } elseif ($Action -eq 'SetColor') { 'Color (non-atomic configuration/palette)' } elseif ($Action -eq 'SetSpeed') { 'Speed' } elseif ($Action -in @('SetEffect', 'SetEffectBrightness')) { 'Effect' } else { 'Brightness' }
        $message = $writeKind + ' write was attempted; outcome uncertain. No retry or restoration was attempted. ' + $message
    }
    [Console]::Error.WriteLine($message)
    exit 1
}
