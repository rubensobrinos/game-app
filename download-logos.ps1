# Download all logo SVGs from cdn.simpleicons.org
# Run from the Game app folder: .\download-logos.ps1

$logosDir = Join-Path $PSScriptRoot "logos"
if (-not (Test-Path $logosDir)) { New-Item -ItemType Directory -Path $logosDir | Out-Null }

$slugs = @(
  # EASY
  'apple','google','microsoft','amazon','netflix','spotify','youtube','instagram',
  'whatsapp','x','meta','samsung','nike','adidas','tesla','paypal','ikea',
  'starbucks','bmw','volkswagen','nintendo','playstation','visa','mastercard','linkedin',
  # MEDIUM
  'uber','airbnb','slack','discord','reddit','snapchat','tiktok','zoom','adobe',
  'intel','twitch','steam','figma','canva','dropbox','ebay','github','docker',
  'nvidia','amd','dell','hp','puma','redbull','duolingo','notion','audi','toyota',
  'xbox','shopify',
  # HARD
  'stripe','atlassian','cloudflare','vercel','netlify','salesforce','oracle',
  'mongodb','gitlab','digitalocean','revolut','coinbase','openai','ubisoft',
  'epicgames','ea','porsche','ferrari','ford','philips','siemens','booking',
  'huggingface','binance','lenovo',
  # EXTREME
  'hashicorp','supabase','redis','elastic','grafana','kubernetes','terraform',
  'ansible','datadog','fastly','akamai','newrelic','splunk','jenkins','sonarqube',
  'pocketbase','sentry','linear','loom','miro'
)

$total  = $slugs.Count
$done   = 0
$failed = @()

foreach ($slug in $slugs) {
  $dest = Join-Path $logosDir "$slug.svg"
  if (Test-Path $dest) {
    $done++
    Write-Progress -Activity "Logos" -Status "$slug (cached)" -PercentComplete ([int](($done/$total)*100))
    continue
  }
  $url = "https://cdn.simpleicons.org/$slug"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
    $done++
    Write-Progress -Activity "Logos" -Status "Downloaded $slug  ($done/$total)" -PercentComplete ([int](($done/$total)*100))
  } catch {
    $failed += $slug
    Write-Host "FAILED: $slug" -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 100
}

Write-Progress -Activity "Logos" -Completed
Write-Host ""
Write-Host "Done. $done / $total logos downloaded." -ForegroundColor Green
if ($failed.Count -gt 0) {
  Write-Host "Failed slugs: $($failed -join ', ')" -ForegroundColor Yellow
}
