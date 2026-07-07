#!/usr/bin/env pwsh
# AfterLink npm/GitHub publish script
# Run this from: C:\Users\javal\Videos\AfterLink

param(
  [Parameter(Mandatory=$false)]
  [string]$Registry = "https://npm.pkg.github.com"
)

Set-Location "C:\Users\javal\Videos\AfterLink"

Write-Host "`n========== AfterLink Publish Script ==========" -ForegroundColor Cyan
Write-Host "Target Registry: $Registry" -ForegroundColor Cyan
Write-Host ""

# Ensure all packages are built before publishing
Write-Host "Building packages..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Build failed. Aborting publish." -ForegroundColor Red
  exit 1
}
Write-Host "✅ Build completed successfully.`n" -ForegroundColor Green

# Prepare npm scope if publishing to public npm registry
if ($Registry -eq "https://registry.npmjs.org" -or $Registry -eq "https://registry.npmjs.org/") {
  Write-Host "Preparing package scopes for public npm release..." -ForegroundColor Yellow
  node scripts/prepare-npm-publish.js
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to prepare package scopes. Aborting publish." -ForegroundColor Red
    exit 1
  }
  Write-Host "✅ Package scopes prepared.`n" -ForegroundColor Green

  # Re-run pnpm install to map renamed packages in the workspace
  Write-Host "Re-running pnpm install to resolve workspace names..." -ForegroundColor Yellow
  pnpm install --no-frozen-lockfile
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to update workspace mappings. Aborting publish." -ForegroundColor Red
    exit 1
  }
  Write-Host "✅ Workspace mappings updated.`n" -ForegroundColor Green
}

# ── Helper ────────────────────────────────────────────────────────────
function Publish-Package {
  param($dir, $pkgNamePlaceholder)
  
  # Read actual package name and version from package.json
  $pkgJsonPath = Join-Path $dir "package.json"
  $pkgJson = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
  $pkgName = $pkgJson.name
  $pkgVersion = $pkgJson.version
  
  Write-Host "Publishing $pkgName@$pkgVersion to $Registry..." -ForegroundColor Yellow
  Set-Location $dir
  pnpm publish --no-git-checks --access public --registry=$Registry
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ $pkgName@$pkgVersion published!" -ForegroundColor Green
  } else {
    Write-Host "  ❌ $pkgName@$pkgVersion FAILED (already at this version? skip and continue)" -ForegroundColor Red
  }
  Set-Location "C:\Users\javal\Videos\AfterLink"
  Write-Host ""
}

# ── Publish in dependency order ───────────────────────────────────────

# 1. Core (no AfterLink deps)
Publish-Package "packages\core"          "@ajaymyth/core@2.0.2"

# 2. Server (depends on core)
Publish-Package "packages\server"        "@ajaymyth/server@2.0.2"

# 3. Cluster (depends on server)
Publish-Package "packages\cluster"       "@ajaymyth/cluster@2.0.2"

# 4. Client (depends on core)
Publish-Package "packages\client"        "@ajaymyth/client@2.0.2"

# 5. Browser SDK (depends on core)
Publish-Package "packages\browser"       "@ajaymyth/browser@2.0.2"

# 6. CLI (depends on core)
Publish-Package "packages\cli"           "@ajaymyth/cli@2.0.2"

# 7. AI Assistant
Publish-Package "packages\ai-assistant"  "@ajaymyth/ai-assistant@2.0.2"

# 8. Umbrella package (depends on all above)
Publish-Package "packages\afterlink"     "afterlink@2.0.2"

Write-Host "========== Publish Complete! ==========" -ForegroundColor Cyan
Write-Host ""

# ── Verify ────────────────────────────────────────────────────────────
if ($Registry -eq "https://registry.npmjs.org") {
  Write-Host "Verifying install works..." -ForegroundColor Yellow
  $tmpDir = Join-Path $env:TEMP "afterlink-verify-$(Get-Random)"
  New-Item -ItemType Directory -Path $tmpDir | Out-Null
  Set-Location $tmpDir
  npm init -y | Out-Null
  npm install afterlink --registry=$Registry
  if ($LASTEXITCODE -eq 0) {
    node -e "const a = require('afterlink'); console.log('afterlink loaded OK:', typeof a)"
    Write-Host "`n✅ npm install afterlink works!" -ForegroundColor Green
  } else {
    Write-Host "`n❌ npm install afterlink failed" -ForegroundColor Red
  }
  Set-Location "C:\Users\javal\Videos\AfterLink"
  Remove-Item $tmpDir -Recurse -Force
}
