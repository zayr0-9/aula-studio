# Persistent, session-only direct lighting. No configuration setters or restoration.
# TransportPath is supplied only by trusted main code, never renderer input.
param(
    [string]$TransportPath = (Join-Path $PSScriptRoot 'brightness.ps1'),
    [switch]$CompileCheck,
    [switch]$Execute
)
$ErrorActionPreference = 'Stop'
try {
    if ($CompileCheck -and $Execute) { throw 'Conflicting mode' }
    $text = Get-Content -LiteralPath $TransportPath -Raw
    $match = [regex]::Match($text, "(?s)\`$source = @'\r?\n(.*?)\r?\n'@")
    if (-not $match.Success) { throw 'Missing transport source' }
    $streamSource = @'
using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

public static class AulaStreamSession {
    public const int IntervalMs = 800, LeaseMs = 2500, MaxSessionMs = 1800000, MaxLine = 8192;
    static readonly int[] Slots = {
        0,12,18,24,30,36,42,48,54,60,66,72,78,
        1,7,13,19,25,31,37,43,49,55,61,67,73,79,85,
        2,8,14,20,26,32,38,44,50,56,62,68,74,80,86,
        3,9,15,21,27,33,39,45,51,57,63,69,81,87,
        4,10,16,22,28,34,40,46,52,58,64,70,82,88,
        5,11,17,35,53,59,77,83,89
    };
    static object Guard(string name, params object[] args) {
        MethodInfo method = typeof(AulaBrightnessTransport).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static);
        if (method == null) throw new InvalidOperationException("Missing transport guard");
        return method.Invoke(null, args);
    }
    // Never allocate an unbounded Console.ReadLine string. One pending read only.
    public static string ReadBoundedLine(TextReader reader) {
        var chars = new char[MaxLine]; int length = 0;
        for (;;) {
            int ch = reader.Read();
            if (ch == -1) {
                if (length == 0) return null;
                throw new InvalidDataException("Incomplete command");
            }
            if (ch == '\n') {
                if (length > 0 && chars[length - 1] == '\r') length--;
                return new string(chars, 0, length);
            }
            if (length == MaxLine) throw new InvalidDataException("Command too long");
            chars[length++] = (char)ch;
        }
    }
    // Null means stop; otherwise returns only a fixed command08 report.
    public static byte[] Encode(string line) {
        if (line == null || line.Length == 0 || line.Length > MaxLine) throw new ArgumentException("Invalid command");
        var serializer = new JavaScriptSerializer { MaxJsonLength = MaxLine, RecursionLimit = 8 };
        var command = serializer.DeserializeObject(line) as Dictionary<string, object>;
        if (command == null || command.Count != 1) throw new ArgumentException("Invalid command");
        object value;
        if (command.TryGetValue("stop", out value)) {
            if (!(value is bool) || !(bool)value) throw new ArgumentException("Invalid stop");
            return null;
        }
        if (!command.TryGetValue("colors", out value)) throw new ArgumentException("Invalid command");
        var colors = value as object[];
        if (colors == null || colors.Length != 90) throw new ArgumentException("Expected 90 RGB slots");
        var report = new byte[520];
        byte[] header = { 6, 8, 0, 0, 1, 0, 122, 1 };
        Array.Copy(header, report, 8);
        var mapped = new bool[90]; foreach (int slot in Slots) mapped[slot] = true;
        for (int slot = 0; slot < 90; slot++) {
            var rgb = colors[slot] as object[];
            if (rgb == null || rgb.Length != 3) throw new ArgumentException("Expected RGB triplet");
            for (int c = 0; c < 3; c++) {
                if (!(rgb[c] is int) || (int)rgb[c] < 0 || (int)rgb[c] > 255)
                    throw new ArgumentException("Expected byte integer");
                // Layout gaps are forced black even if a caller supplies color there.
                if (mapped[slot]) report[8 + slot * 3 + c] = (byte)(int)rgb[c];
            }
        }
        return report;
    }
    public static void RequireOff(byte[] cfg) {
        if (cfg == null || cfg.Length != 520 || cfg[17] != 0 || cfg[18] != 0)
            throw new InvalidOperationException("Ordinary off mode required");
    }
    static void Event(string name) { Console.Out.WriteLine("{\"event\":\"" + name + "\"}"); Console.Out.Flush(); }
    public static void Run() {
        if (IntPtr.Size != 8) throw new InvalidOperationException("x64 required");
        string[] names = { "InterfaceData", "Caps", "ValueCaps", "Attributes" };
        int[] sizes = { 32, 64, 72, 12 };
        for (int i = 0; i < names.Length; i++) {
            Type nested = typeof(AulaBrightnessTransport).GetNestedType(names[i], BindingFlags.NonPublic);
            if (nested == null || Marshal.SizeOf(nested) != sizes[i]) throw new InvalidOperationException("Unexpected ABI");
        }
        using (var mutex = new Mutex(false, @"Global\AulaBrightness_VID258A_PID010C_MI01_COL06")) {
            bool owned = false;
            try {
                try { owned = mutex.WaitOne(0); }
                catch (AbandonedMutexException) { owned = true; throw new InvalidOperationException("Interrupted transaction"); }
                if (!owned) throw new InvalidOperationException("Controller busy");
                Guard("CheckOfficialApp");
                string path = (string)Guard("FindCollection");
                Guard("CheckOfficialApp");
                using (var handle = (SafeFileHandle)Guard("CreateFile", path, (uint)0, (uint)3, IntPtr.Zero, (uint)3, (uint)0, IntPtr.Zero)) {
                    if (handle.IsInvalid) throw new InvalidOperationException("Open failed");
                    Guard("VerifyCollection", handle);
                    byte[] initialConfiguration = (byte[])Guard("IndicatorQuery", handle, true, true);
                    if (initialConfiguration[17] != 0 || initialConfiguration[18] != 0) {
                        Event("requires-off");
                        return; // Admission refusal only: no direct frame was sent.
                    }
                    RequireOff(initialConfiguration);
                    var clock = Stopwatch.StartNew();
                    long lastRequest = 0, lastSend = -IntervalMs;
                    Event("ready");
                    for (;;) {
                        // Do not accumulate frame tasks/commands. Main must keep at most one
                        // command outstanding, waiting for frame acknowledgement before refill.
                        while (clock.ElapsedMilliseconds - lastSend < IntervalMs) {
                            if (clock.ElapsedMilliseconds >= MaxSessionMs || clock.ElapsedMilliseconds - lastRequest >= LeaseMs)
                                throw new TimeoutException();
                            Thread.Sleep(10);
                        }
                        Task<string> read = Task.Factory.StartNew(() => ReadBoundedLine(Console.In), CancellationToken.None,
                            TaskCreationOptions.LongRunning, TaskScheduler.Default);
                        while (!read.Wait(50)) {
                            if (clock.ElapsedMilliseconds >= MaxSessionMs || clock.ElapsedMilliseconds - lastRequest >= LeaseMs)
                                throw new TimeoutException();
                        }
                        if (clock.ElapsedMilliseconds >= MaxSessionMs || clock.ElapsedMilliseconds - lastRequest >= LeaseMs)
                            throw new TimeoutException();
                        string line = read.Result;
                        if (line == null) break;
                        byte[] report = Encode(line);
                        if (report == null) break;
                        lastRequest = clock.ElapsedMilliseconds;
                        Guard("CheckOfficialApp");
                        if (clock.ElapsedMilliseconds >= MaxSessionMs || clock.ElapsedMilliseconds - lastRequest >= LeaseMs)
                            throw new TimeoutException();
                        // API call is synchronous: parent must kill process on its own timeout.
                        lastSend = clock.ElapsedMilliseconds;
                        if (!(bool)Guard("HidD_SetFeature", handle, report, 520)) throw new IOException("Uncertain send");
                        // Gap is measured after completion (stronger than start-to-start).
                        lastSend = clock.ElapsedMilliseconds;
                        Event("frame");
                    }
                }
                Event("stopped");
            } finally { if (owned) mutex.ReleaseMutex(); }
        }
    }
}
'@
    if (-not ('AulaStreamSession' -as [type])) {
        # Compile together: Add-Type's first in-memory assembly is not a compiler reference.
        # Use the same production source in this assembly for guarded reflection reuse.
        Add-Type -TypeDefinition ("using System.IO; using System.Reflection; using System.Threading.Tasks; using System.Web.Script.Serialization;`n" + $match.Groups[1].Value + "`n" + $streamSource.Replace('using System;', '').Replace('using System.IO;', '').Replace('using System.Collections;', '').Replace('using System.Collections.Generic;', '').Replace('using System.Diagnostics;', '').Replace('using System.Reflection;', '').Replace('using System.Runtime.InteropServices;', '').Replace('using System.Threading;', '').Replace('using System.Threading.Tasks;', '').Replace('using System.Web.Script.Serialization;', '').Replace('using Microsoft.Win32.SafeHandles;', '')) -ReferencedAssemblies 'System.Web.Extensions' 
    }
    if ($Execute) { [AulaStreamSession]::Run() }
    else { '{"compileOnly":true}' }
} catch {
    [Console]::Error.WriteLine('Streaming session failed; device state may be uncertain. No retry or restoration.')
    exit 1
}
