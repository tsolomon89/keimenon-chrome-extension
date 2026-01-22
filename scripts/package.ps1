$version = (Get-Content -Raw -Path "manifest.json" | ConvertFrom-Json).version
$zipName = "keimenon-lite-v$version.zip"

Write-Host "Packaging Keimenon Lite v$version..."

# Define artifacts to include
$includes = @(
    "manifest.json",
    "src", 
    "icons",
    "README.md",
    "PRIVACY_POLICY.md"
)

# Remove old zip if exists
if (Test-Path $zipName) {
    Remove-Item $zipName
}

# Create Zip
Compress-Archive -Path $includes -DestinationPath $zipName

Write-Host "✅ Successfully created $zipName"
Write-Host "Ready for Chrome Web Store upload."
