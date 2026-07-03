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

# ── Helper ────────────────────────────────────────────────────────────
function Publish-Package {
  param($dir, $pkg)
  Write-Host "Publishing $pkg to $Registry..." -ForegroundColor Yellow
  Set-Location $dir
  pnpm publish --no-git-checks --access public --registry=$Registry
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ $pkg published!" -ForegroundColor Green
  } else {
    Write-Host "  ❌ $pkg FAILED (already at this version? skip and continue)" -ForegroundColor Red
  }
  Set-Location "C:\Users\javal\Videos\AfterLink"
  Write-Host ""
}

# ── Publish in dependency order ───────────────────────────────────────

# 1. Core (no AfterLink deps)
Publish-Package "packages\core"          "@ajaymyth/core@2.0.1"

# 2. Server (depends on core)
Publish-Package "packages\server"        "@ajaymyth/server@2.0.1"

# 3. Cluster (depends on server)
Publish-Package "packages\cluster"       "@ajaymyth/cluster@2.0.1"

# 4. Client (depends on core)
Publish-Package "packages\client"        "@ajaymyth/client@2.0.1"

# 5. Browser SDK (depends on core)
Publish-Package "packages\browser"       "@ajaymyth/browser@2.0.1"

# 6. CLI (depends on core)
Publish-Package "packages\cli"           "@ajaymyth/cli@2.0.1"

# 7. AI Assistant
Publish-Package "packages\ai-assistant"  "@ajaymyth/ai-assistant@2.0.1"

# 8. Umbrella package (depends on all above)
Publish-Package "packages\afterlink"     "afterlink@2.0.1"

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
