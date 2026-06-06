#!/usr/bin/env pwsh
# AfterLink npm publish script
# Run this from: C:\Users\javal\Videos\AfterLink
# Prerequisites: npm login (already done as ajay.j_dev)

Set-Location "C:\Users\javal\Videos\AfterLink"

Write-Host "`n========== AfterLink npm Publish Script ==========" -ForegroundColor Cyan
Write-Host "Logged in as: ajay.j_dev" -ForegroundColor Green
Write-Host ""

# ── Helper ────────────────────────────────────────────────────────────
function Publish-Package {
  param($dir, $pkg)
  Write-Host "Publishing $pkg..." -ForegroundColor Yellow
  Set-Location $dir
  npm publish --access public
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
Publish-Package "packages\core"          "@afterlink/core@1.2.2"

# 2. Server (depends on core)
Publish-Package "packages\server"        "@afterlink/server@1.2.2"

# 3. Client (depends on core)
Publish-Package "packages\client"        "@afterlink/client@1.2.2"

# 4. Browser SDK (depends on core)
Publish-Package "packages\browser"       "@afterlink/browser@1.2.2"

# 5. CLI (depends on core)
Publish-Package "packages\cli"           "@afterlink/cli@1.2.2"

# 6. AI Assistant (NEW — first publish)
Publish-Package "packages\ai-assistant"  "@afterlink/ai-assistant@1.2.2"

# 7. Umbrella package (depends on all above)
Publish-Package "packages\afterlink"     "afterlink@1.2.2"

Write-Host "========== Publish Complete! ==========" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verifying install works..." -ForegroundColor Yellow

# ── Verify ────────────────────────────────────────────────────────────
$tmpDir = Join-Path $env:TEMP "afterlink-verify-$(Get-Random)"
New-Item -ItemType Directory -Path $tmpDir | Out-Null
Set-Location $tmpDir
npm init -y | Out-Null
npm install afterlink
if ($LASTEXITCODE -eq 0) {
  node -e "const a = require('afterlink'); console.log('afterlink loaded OK:', typeof a)"
  Write-Host "`n✅ npm install afterlink works!" -ForegroundColor Green
} else {
  Write-Host "`n❌ npm install afterlink failed" -ForegroundColor Red
}
Set-Location "C:\Users\javal\Videos\AfterLink"
Remove-Item $tmpDir -Recurse -Force
