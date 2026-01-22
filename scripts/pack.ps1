
Write-Host "Building..."
npm run build

$source = "C:\Development\Projects\keimenon-lite"
$manifestPath = Join-Path $source "manifest.json"

# Read Version
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

# Prepare Dist
$distDir = Join-Path $source "dist"
if (!(Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

# Generate Filename
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipName = "keimenon-lite-v${version}-${timestamp}.zip"
$destination = Join-Path $distDir $zipName

Write-Host "Packaging v$version to: $destination"

# Get Items to Zip (Avoiding recursion into dist)
$items = Get-ChildItem -Path $source | Where-Object { 
    $_.Name -notin @("dist", "node_modules", ".git", ".vscode", "test", "tests", "vitest.config.ts", "package-lock.json") -and 
    !($_.Name.StartsWith(".")) 
}

# Zip
Compress-Archive -Path $items.FullName -DestinationPath $destination -CompressionLevel Optimal -Force

Write-Host "Success. Artifact created at $destination"
Write-Host "Items included: $($items.Name -join ', ')"
