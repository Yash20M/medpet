# Builds a release APK that talks to the given API.
#   .\build-apk.ps1 -ApiUrl https://medpet-api.onrender.com/api
# Output: application\MedPet-release.apk
#
# The native (CMake/ninja) steps break on long OneDrive paths on Windows, so the
# project is mirrored to a short folder outside OneDrive and built there.
param(
  [Parameter(Mandatory = $true)][string]$ApiUrl,
  [string]$Architectures = "arm64-v8a,armeabi-v7a",
  [string]$BuildDir = "C:\mpb\app"
)
$ErrorActionPreference = "Stop"

try {
  $health = ($ApiUrl -replace '/api/?$', '') + '/health'
  Invoke-RestMethod -Uri $health -TimeoutSec 90 | Out-Null
  Write-Host "API reachable: $health"
} catch {
  Write-Warning "Could not reach $health - the APK will still build, but check the URL."
}

$src = $PSScriptRoot
Write-Host "Syncing project to $BuildDir ..."
robocopy $src $BuildDir /MIR /MT:16 /NFL /NDL /NP /NJH /NJS `
  /XD .cxx .gradle .expo "$src\android\build" "$src\android\app\build" "$src\android\app\.cxx" `
  /XF *.apk | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:NODE_ENV = "production"
Push-Location "$BuildDir\android"
try {
  .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Architectures" --console=plain
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
} finally {
  Pop-Location
}

$out = "$src\MedPet-release.apk"
Copy-Item "$BuildDir\android\app\build\outputs\apk\release\app-release.apk" $out -Force
Write-Host "APK ready: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB) -> API $ApiUrl"
