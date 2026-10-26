param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArguments)
$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskLocalNode = Join-Path $taskProjectRoot '.local\node-v24.22.1-win-x64'
$taskPreviousPath = $env:Path
$taskExitCode = 1
Push-Location $taskProjectRoot
try {
  if (Test-Path -LiteralPath (Join-Path $taskLocalNode 'node.exe')) {
    $env:Path = $taskLocalNode + ';' + $env:Path
  }
  $taskVersion = & node --version
  if ($taskVersion -notmatch '^v24\.' -or [version]($taskVersion.Substring(1)) -lt [version]'24.22.1') {
    throw 'Du an can Node 24.22.1+ tren dong 24. Khong thay Node toan may tu dong.'
  }
  & npm.cmd @NpmArguments
  $taskExitCode = $LASTEXITCODE
} finally {
  $env:Path = $taskPreviousPath
  Pop-Location
}
exit $taskExitCode
