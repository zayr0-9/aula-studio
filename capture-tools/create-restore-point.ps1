$ErrorActionPreference = 'Stop'
$report = 'D:\Projects\aula\capture-tools\restore-point-creation.txt'
try {
    $name = 'Before USBPcap installation ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $before = @(Get-ComputerRestorePoint)
    'Requested: ' + $name | Out-File $report -Encoding utf8
    Checkpoint-Computer -Description $name -RestorePointType MODIFY_SETTINGS -WarningAction Stop
    $after = @(Get-ComputerRestorePoint)
    $created = @($after | Where-Object { $_.Description -eq $name -and $_.SequenceNumber -notin $before.SequenceNumber })
    if ($created.Count -eq 0) { throw 'No new matching restore point found. No frequency policy or protection settings were changed.' }
    'VERIFIED: New restore point exists.' | Out-File $report -Append -Encoding utf8
    $created | Select-Object SequenceNumber, Description, CreationTime, RestorePointType | Format-List | Out-File $report -Append -Encoding utf8
    exit 0
} catch {
    ('FAILED: ' + $_.Exception.Message) | Out-File $report -Append -Encoding utf8
    exit 1
}
