$faviconDir = "..\assets\favicon"
$iconsDir = "..\icons"

# Ensure dirs exist
if (!(Test-Path $faviconDir)) { New-Item -ItemType Directory -Path $faviconDir | Out-Null }
if (!(Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

# Get first image file
$srcIcon = Get-ChildItem -Path $faviconDir | Where-Object { $_.Extension -match "\.(png|jpg|jpeg|svg|ico)$" } | Select-Object -First 1

if ($srcIcon) {
    Write-Host "Found favicon: $($srcIcon.Name)"
    
    # Simple copy for now - real resizing requires extra libs in PS/Node usually not present in basic environment.
    # We will just copy it to the names Chrome expects. 
    # Chrome handles resizing fairly well if it's high res.
    
    $targets = @("icon16.png", "icon48.png", "icon128.png")
    
    foreach ($target in $targets) {
        Copy-Item -Path $srcIcon.FullName -Destination (Join-Path $iconsDir $target) -Force
        Write-Host "Updated $target"
    }
} else {
    Write-Host "No icon found in $faviconDir. Skipping icon update."
}
