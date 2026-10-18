# Focused ordinary-key inventory only. NO remapping, hooks, injection or HID requests.
param([switch]$Run, [switch]$CompileCheck)
$ErrorActionPreference='Stop'
if($Run -and $CompileCheck){throw 'Choose Run or CompileCheck'}
Add-Type -AssemblyName System.Windows.Forms
$source=@'
using System;
using System.Collections.Generic;
using System.Text;
using System.Windows.Forms;
public sealed class KeyInventory : Form {
    readonly Dictionary<int,string> expected = new Dictionary<int,string>();
    readonly HashSet<int> seen = new HashSet<int>();
    readonly ListBox remaining = new ListBox();
    readonly Label status = new Label();
    readonly Timer timer = new Timer();
    readonly System.Diagnostics.Stopwatch clock = new System.Diagnostics.Stopwatch();
    bool armed;
    public KeyInventory(int[] codes,string[] names) {
        if(codes.Length!=names.Length || codes.Length<1) throw new ArgumentException("Invalid inventory");
        for(int i=0;i<codes.Length;i++) expected.Add(codes[i],names[i]);
        Text="F75 ordinary-key inventory - any order - NO mapping writes";
        Width=800; Height=650; KeyPreview=true;
        var instructions=new Label { Dock=DockStyle.Top,Height=110,Text="Press each ORDINARY physical key once, in ANY ORDER. Duplicates are ignored.\r\nUse only the F75. Fn, modifiers, knob and shortcuts are outside this test.\r\nClick Arm first. Click Finish when done; automatic finish after 5 minutes.\r\nNo typing content is retained: only allowlisted key identities/checkmarks.\r\nThis checks emitted Windows keys, not independent physical switch identity. Existing remaps must be restored first." };
        status.Dock=DockStyle.Top; status.Height=55;
        remaining.Dock=DockStyle.Fill;
        var arm=new Button {Text="Arm test",Dock=DockStyle.Bottom,Height=40};
        arm.Click+=delegate {armed=true;arm.Enabled=false;clock.Restart();timer.Start();};
        var finish=new Button {Text="Finish and save results",Dock=DockStyle.Bottom,Height=40};
        finish.Click+=delegate {Close();};
        Controls.Add(remaining);Controls.Add(status);Controls.Add(instructions);Controls.Add(arm);Controls.Add(finish);
        timer.Interval=200;timer.Tick+=delegate {if(clock.Elapsed.TotalSeconds>=300) Close();};
        RefreshList();
    }
    void RefreshList() {
        remaining.Items.Clear();
        foreach(var key in expected) remaining.Items.Add((seen.Contains(key.Key)?"PASS  ":"WAIT  ")+key.Value);
        status.Text="Observed "+seen.Count+" / "+expected.Count+" ordinary keys. Any order; stay in this window.";
    }
    protected override void OnKeyDown(KeyEventArgs e) {
        if(armed) {
            int code=(int)e.KeyCode;
            if(e.Modifiers==Keys.None && expected.ContainsKey(code)) { seen.Add(code); RefreshList(); }
            e.SuppressKeyPress=true; e.Handled=true;
        }
        base.OnKeyDown(e);
    }
    protected override bool ProcessCmdKey(ref Message message,Keys keyData) {
        if(armed) {
            int code=(int)(keyData & Keys.KeyCode);
            if((keyData & Keys.Modifiers)==Keys.None && expected.ContainsKey(code)) {
                seen.Add(code);RefreshList();
            }
            // Consume focused key commands so Tab/Escape/etc cannot navigate away.
            return true;
        }
        return base.ProcessCmdKey(ref message,keyData);
    }
    protected override void OnFormClosed(FormClosedEventArgs e){timer.Stop();timer.Dispose();base.OnFormClosed(e);}
    public static int[] Observe(int[] codes,string[] names) {
        using(var form=new KeyInventory(codes,names)){Application.Run(form);int[] result=new int[form.seen.Count];form.seen.CopyTo(result);return result;}
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
# Corrected ANSI profile: physical key positions and Windows virtual key labels only.
$p='C:\Program Files (x86)\AULA\F75\Dev\kb\1\KB.ini'
$lines=Get-Content $p
$keys=@();$label=''
foreach($line in $lines){
    # Full records (8 columns) occur only in physical map; FN records have fewer.
    if($line -match '^;(.+)'){$label=$Matches[1].Trim()}
    if($line -match '^K\d+=(.+)$'){
        $parts=$Matches[1]-split ','
        if($parts.Count -ne 8){continue}
        $tag=[Convert]::ToInt32($parts[4].Trim().Replace('0x',''),16)
        $vk=[Convert]::ToInt32($parts[5].Trim().Replace('0x',''),16)
        $matrix=[int]$parts[7]
        # Only standard keyboard records; exclude modifiers, Fn and any special major.
        if($tag -ne 2 -or $vk -in @(16,17,18,91,92,160,161,162,163,164,165,250,251)){continue}
        $name=if($label){$label}else{([Windows.Forms.Keys]$vk).ToString()}
        $keys+=[pscustomobject]@{vk=$vk;matrix=$matrix;name=$name}
    }
}
if($keys.Count -lt 60 -or @($keys.vk|Sort-Object -Unique).Count -ne $keys.Count){throw 'Unexpected or ambiguous ordinary-key map'}
if($CompileCheck){'PASS: window compiled; '+$keys.Count+' unique ordinary keys loaded. No input observation/device I/O.';exit 0}
if(-not $Run){'No test started. Use -Run. This inventory never remaps keys.';exit 0}
$seen=@([KeyInventory]::Observe([int[]]$keys.vk,[string[]]@($keys|ForEach-Object {$_.name+' (matrix '+$_.matrix+')'})))
$result=[ordered]@{time=(Get-Date -Format o);expected=$keys.Count;observed=$seen.Count;complete=($seen.Count -eq $keys.Count);keys=@($keys|ForEach-Object {[ordered]@{name=$_.name;matrix=$_.matrix;vk=$_.vk;observed=($_.vk -in $seen)}});note='Focused Windows emitted-key inventory, any order. No per-device attribution or physical-position proof. No mapping changes, hooks or synthesized input. Exceptions deferred.'}
$path=Join-Path $PSScriptRoot ('../docs/evidence/key-inventory-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$result|ConvertTo-Json -Depth 6|Set-Content $path -Encoding utf8
'Observed '+$seen.Count+'/'+$keys.Count+'; evidence: '+[IO.Path]::GetFullPath($path)
