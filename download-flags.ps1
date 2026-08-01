# Download all flag images from flagcdn.com
# Run from the Game app folder: .\download-flags.ps1

$flagsDir = Join-Path $PSScriptRoot "flags"
if (-not (Test-Path $flagsDir)) { New-Item -ItemType Directory -Path $flagsDir | Out-Null }

$codes = @(
  # EASY
  'fr','de','it','es','nl','be','gb','us','ca','au','br','jp','cn','in','ru',
  'mx','ar','pt','ch','se','no','dk','fi','at','gr','tr','kr','za','eg','sa',
  # MEDIUM
  'pl','cz','hu','ro','ua','hr','rs','ie','is','nz','id','th','vn','my','ph',
  'ng','ke','ma','dz','tn','co','cl','pe','ve','cu','il','ae','ir','pk','bd',
  'lk','kh','kz','sk','si','bg','lt','lv','ee','by','ge','am','az','iq','sy',
  'jo','jm','mm','sg','kw','qa','bh','om','lb','mt','cy','lu','uz','la','tw',
  'kp','al','ba','np','me','md',
  # HARD
  'et','tz','ug','gh','cm','sn','ci','mz','mg','zm','zw','rw','tg','bj','bf',
  'ml','ne','td','cf','so','sd','ly','mr','bo','py','uy','ec','gt','hn','ni',
  'cr','pa','do','ht','mn','kg','tj','tm','af','mk','xk','li','mc','ad','sm',
  'va','ao','na','bw','mw','cd','cg','ga','gq','gw','gn','sl','lr','gm','cv',
  'bi','ss','ls','sz','dj','er','km','st','sc','mu','ye','tt','bb','bs','gd',
  'lc','vc','ag','dm','kn','sv','bz','gy','sr','pg','fj','ws','to','vu','sb',
  'ki','fm','mh','pw','nr','tv','tl','bn','mv','bt','ps','hk','gl','aw'
)

$total  = $codes.Count
$done   = 0
$failed = @()

foreach ($code in $codes) {
  $dest = Join-Path $flagsDir "$code.png"
  if (Test-Path $dest) {
    $done++
    Write-Progress -Activity "Flags" -Status "$code (cached)" -PercentComplete ([int](($done/$total)*100))
    continue
  }
  $url = "https://flagcdn.com/w640/$code.png"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
    $done++
    Write-Progress -Activity "Flags" -Status "Downloaded $code  ($done/$total)" -PercentComplete ([int](($done/$total)*100))
  } catch {
    $failed += $code
    Write-Host "FAILED: $code" -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 50   # be polite to the CDN
}

Write-Progress -Activity "Flags" -Completed
Write-Host ""
Write-Host "Done. $done / $total flags downloaded." -ForegroundColor Green
if ($failed.Count -gt 0) {
  Write-Host "Failed codes: $($failed -join ', ')" -ForegroundColor Yellow
}
