$url = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip"
$zip = "d:\Library\Ashwin\Offical\TamilGaming\AI\Tools\node.zip"
$dest = "d:\Library\Ashwin\Offical\TamilGaming\AI\Tools"

# Create destination folder if not exists
if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest
}

# Download Node.js zip if it doesn't exist
if (!(Test-Path $zip)) {
    Write-Host "Downloading Node.js..."
    Invoke-WebRequest -Uri $url -OutFile $zip
}

# Extract it
Write-Host "Extracting Node.js..."
Expand-Archive -Path $zip -DestinationPath $dest -Force

# Rename the folder to Tools\node
$extractedDir = Join-Path $dest "node-v22.12.0-win-x64"
$finalDir = Join-Path $dest "node"
if (Test-Path $finalDir) {
    Remove-Item $finalDir -Recurse -Force
}
Rename-Item -Path $extractedDir -NewName "node"

# Clean up zip
if (Test-Path $zip) {
    Remove-Item $zip -Force
}

Write-Host "Node.js setup completed successfully!"
