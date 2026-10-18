# Compile-only support: no process starts here. Deadline tied to an owned Process handle.
if (-not ('AulaCaptureDeadline' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Threading;
public sealed class AulaCaptureDeadline : IDisposable {
    readonly Process process;
    readonly Thread worker;
    readonly ManualResetEvent stop = new ManualResetEvent(false);
    public bool Expired { get; private set; }
    public string Failure { get; private set; }
    public AulaCaptureDeadline(Process process, int milliseconds) {
        if (process == null || milliseconds < 100 || milliseconds > 130000) throw new ArgumentException("Invalid deadline");
        // Resolve/retain handle before a PID could be recycled. Never reacquire by PID.
        var handle = process.Handle;
        this.process = process;
        worker = new Thread(delegate() {
            var clock=Stopwatch.StartNew();
            while(!stop.WaitOne(50)) {
                try {
                    if(process.HasExited) return;
                    if(clock.ElapsedMilliseconds >= milliseconds) {
                        Expired=true;
                        process.Kill();
                        if(!process.WaitForExit(3000)) Failure="Owned capture failed to exit after deadline kill";
                        return;
                    }
                } catch(Exception error) { Failure=error.Message; return; }
            }
        });
        worker.IsBackground=true; worker.Name="AULA capture hard deadline"; worker.Start();
    }
    public void Dispose() {
        stop.Set();
        if(!worker.Join(4000)) throw new InvalidOperationException("Deadline worker failed to stop");
        stop.Dispose();
    }
}
'@
}
