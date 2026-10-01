param([Parameter(Mandatory=$true)][string]$Path, [Parameter(Mandatory=$true)][string]$Json)
$dir = Split-Path -Parent $Path
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$tmp = "$Path.tmp"
[System.IO.File]::WriteAllText($tmp, $Json, (New-Object System.Text.UTF8Encoding($false)))
Move-Item -Force $tmp $Path
Write-Output "WROTE $Path ($((Get-Item $Path).Length) bytes)"
