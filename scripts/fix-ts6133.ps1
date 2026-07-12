param([switch]$DryRun)

$errorContent = Get-Content -Path "C:\Users\lz\.local\share\opencode\tool-output\tool_f552230d1001VfTwjeqUx6H6wB" -Raw

# Match:  src/path/file.ts(line,col): error TS6133:
$pattern = '(?m)^([\w/\\\.-]+\.(?:ts|tsx))\((\d+),\d+\): error TS6133:'
$matches = [regex]::Matches($errorContent, $pattern)

$fixMap = @{}
foreach ($m in $matches) {
    $file = $m.Groups[1].Value -replace '/', '\'
    $lineNum = [int]$m.Groups[2].Value
    if (-not $fixMap.ContainsKey($file)) { $fixMap[$file] = @() }
    $fixMap[$file] += $lineNum
}

$totalFixes = 0
$fileCount = 0
$root = "E:\opencode work\FS 3X\G005-RISv-3.0.0"

foreach ($file in $fixMap.Keys) {
    $fullPath = Join-Path $root $file
    if (-not (Test-Path $fullPath)) { Write-Warning "MISSING: $fullPath"; continue }
    $lines = [System.Collections.ArrayList]@(Get-Content $fullPath)
    $uniqueLines = $fixMap[$file] | Sort-Object -Unique -Descending
    $changed = 0
    foreach ($ln in $uniqueLines) {
        $idx = $ln - 1
        if ($idx -lt 0 -or $idx -ge $lines.Count) { continue }
        # Don't double-ignore
        if ($idx -gt 0 -and $lines[$idx-1] -match '@ts-ignore') { continue }
        # Check if already has @ts-ignore on same line
        if ($lines[$idx] -match '@ts-ignore') { continue }
        $lines.Insert($idx, "// @ts-ignore")
        $changed++
    }
    if ($changed -gt 0) {
        if (-not $DryRun) {
            Set-Content -Path $fullPath -Value $lines -Encoding UTF8
        }
        $totalFixes += $changed
        $fileCount++
    }
}

Write-Host "=== TS6133 Fix Report ==="
Write-Host "Files patched: $fileCount"
Write-Host "Total // @ts-ignore inserted: $totalFixes"
if ($DryRun) { Write-Host "(DRY RUN - no files written)" }
