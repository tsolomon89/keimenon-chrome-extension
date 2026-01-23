
$source = "C:\Development\Projects\keimenon-lite"
$packagePath = Join-Path $source "package.json"
$manifestPath = Join-Path $source "manifest.json"

# 1. Read & Bump Version
Write-Host "Reading version..."
$pkg = Get-Content $packagePath -Raw | ConvertFrom-Json
$currentVersion = $pkg.version
$vParts = $currentVersion.Split('.')
# Increment patch (e.g. 1.0.0 -> 1.0.1)
$newVersion = "$($vParts[0]).$($vParts[1]).$([int]$vParts[2] + 1)"

Write-Host "Bumping version: $currentVersion -> $newVersion"

# 2. Update package.json
$pkg.version = $newVersion
$pkg | ConvertTo-Json -Depth 10 | Set-Content $packagePath -Encoding UTF8

# 3. Update manifest.json
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.version = $newVersion
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

# 4. Build (now that version is updated)
Write-Host "Building..."
npm run build

$version = $newVersion

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
