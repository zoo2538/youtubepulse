$ts = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$dest = "C:\youtubepulse_backup_$ts"

# Create destination folder
New-Item -ItemType Directory -Path $dest -Force | Out-Null

# Copy project excluding heavy/generated folders
robocopy "C:\youtubepulse" $dest /E /XD node_modules dist "dist-electron" .git | Out-Null

# Write backup info
@(
  '# YouTube Pulse Backup',
  '',
  "- Date: $ts",
  '- Source: C:\youtubepulse',
  '- Excluded: node_modules, dist, dist-electron, .git'
) | Set-Content -Path "$dest\BACKUP_INFO.md" -Encoding UTF8

# Output destination path
Write-Output $dest













