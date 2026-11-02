# Run from the project root after installing dependencies and building.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules/tsx/dist/cli.mjs')) {
  throw 'Dependencies are missing. Install Node.js 24+ and run npm ci first.'
}
if (-not (Test-Path -LiteralPath 'dist/index.html')) {
  & node node_modules/typescript/bin/tsc --noEmit
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & node node_modules/vite/bin/vite.js build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& node node_modules/tsx/dist/cli.mjs server/index.ts
exit $LASTEXITCODE
