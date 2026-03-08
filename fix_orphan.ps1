$f = 'c:\Users\HP\Desktop\github\college\frontend\src\App.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Keep lines 0-451 (1-indexed: 1-452) and 623 onwards (1-indexed: 624+)
$keep = $lines[0..451] + $lines[623..($lines.Length - 1)]
[System.IO.File]::WriteAllLines($f, $keep, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. Removed lines 453-623. New length: $($keep.Length)"
