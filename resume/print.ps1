# Prints resume.html to the PDF the site serves, using headless Microsoft Edge (or Chrome).
# Usage, from the repo root:  powershell -ExecutionPolicy Bypass -File resume/print.ps1 [output.pdf]
param([string]$Out = (Join-Path $PSScriptRoot '..\public\Kulsum-Timol-Resume.pdf'))

$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Install Microsoft Edge or Google Chrome to print the resume.' }

$url = ([Uri](Join-Path $PSScriptRoot 'resume.html')).AbsoluteUri
$pdf = [IO.Path]::GetFullPath($Out)
# The virtual time budget gives the web fonts time to load before the page is printed.
$args = @('--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=10000', "--print-to-pdf=`"$pdf`"", $url)
Start-Process -FilePath $browser -ArgumentList $args -Wait -NoNewWindow
if (-not (Test-Path $pdf)) { throw "Printing failed: $pdf was not created." }
"Wrote $pdf"
