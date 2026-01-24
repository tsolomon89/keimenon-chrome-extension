$ErrorActionPreference = "Stop"

# Use current location as project root (assuming script is run from root or we can derive it)
# Ideally, we find the root based on script location, but user seems to run from root.
# Let's try to be smart. If manifest.json is not in current dir, check up one level.
if (-not (Test-Path "manifest.json")) {
    if (Test-Path "..\manifest.json") {
        Set-Location ..
    } else {
        Write-Error "Could not find manifest.json in current directory or parent."
        exit 1
    }
}

Write-Host "Reading current version..."
$pkgPath = "package.json"
$manifestPath = "manifest.json"

# 1. Read & Bump Version
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$currentVersion = $pkg.version

$vParts = $currentVersion.Split('.')
if ($vParts.Count -ne 3) {
    Write-Error "Version format unexpected: $currentVersion. Expected x.y.z"
    exit 1
}

# Increment patch (e.g. 1.0.0 -> 1.0.1)
$newVersion = "$($vParts[0]).$($vParts[1]).$([int]$vParts[2] + 1)"
Write-Host "Bumping version: $currentVersion -> $newVersion"

# 2. Update package.json
$pkg.version = $newVersion
$pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding UTF8

# 3. Update manifest.json
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.version = $newVersion
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

# 4. Build
Write-Host "Building project..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed."
    exit $LASTEXITCODE
}

# 5. Package
# 5. Package
$zipName = "keimenon-lite-v$newVersion.zip"
$distDir = "dist"
$stagingDir = Join-Path $distDir "staging"

# Ensure dist exists
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null
}

# Clean/Create Staging
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

Write-Host "Staging files..."

# Copy items to staging
$includes = @(
    "manifest.json",
    "assets",
    "README.md",
    "PRIVACY_POLICY.md"
)

foreach ($item in $includes) {
    Copy-Item -Path $item -Destination $stagingDir -Recurse -Force
}

# Copy src manually to handle exclusions
$srcDest = Join-Path $stagingDir "src"
New-Item -ItemType Directory -Force -Path $srcDest | Out-Null
Copy-Item -Path "src\*" -Destination $srcDest -Recurse -Force

# EXCLUDE DEV FILES
Write-Host "Removing dev files from package..."
$exclusions = @(
    "ui\dev-preview.html",
    "ui\dev-mocks.js"
)

foreach ($ex in $exclusions) {
    $target = Join-Path $srcDest $ex
    if (Test-Path $target) {
        Remove-Item $target -Force
        Write-Host "  - Excluded: $ex"
    }
}

# Zip from Staging
$zipPath = Join-Path $distDir $zipName
if (Test-Path $zipPath) { Remove-Item $zipPath }

Write-Host "Creating archive: $zipPath"
Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath -Force

# Cleanup Staging
Remove-Item $stagingDir -Recurse -Force

Write-Host "✅ Successfully packaged version $newVersion to $zipPath"
