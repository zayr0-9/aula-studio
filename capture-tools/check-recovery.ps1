$ErrorActionPreference = 'Continue'
$report = 'D:\Projects\aula\capture-tools\recovery-status.txt'
& {
    'Read-only recovery status check: ' + (Get-Date -Format o)
    '--- Restore points ---'
    try {
        $points = @(Get-ComputerRestorePoint -ErrorAction Stop)
        'RestorePointCount=' + $points.Count
        $points | Select-Object SequenceNumber, Description, CreationTime, RestorePointType | Format-Table -AutoSize
    } catch { $_.Exception.Message }
    '--- Windows Recovery Environment ---'
    reagentc /info
    '--- Shadow storage ---'
    vssadmin list shadowstorage
    '--- System protection policy ---'
    Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\SystemRestore' -ErrorAction SilentlyContinue | Select-Object DisableSR, DisableConfig | Format-List
    '--- OS drive encryption status (no keys) ---'
    manage-bde -status C:
    '--- Windows Backup status ---'
    wbadmin get versions
} *>&1 | Out-File -FilePath $report -Encoding utf8
