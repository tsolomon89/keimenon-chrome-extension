
param (
    [string]$SourcePath,
    [string]$DestDir
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source file not found: $SourcePath"
    exit 1
}

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir
}

$bmp = [System.Drawing.Bitmap]::FromFile($SourcePath)
$sizes = 16, 48, 128

foreach ($s in $sizes) {
    $new = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($new)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $g.DrawImage($bmp, 0, 0, $s, $s)
    
    $destFile = Join-Path $DestDir "icon$s.png"
    $new.Save($destFile, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Created $destFile"
    
    $g.Dispose()
    $new.Dispose()
}

$bmp.Dispose()
