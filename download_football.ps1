# Maps each club slug to its api-sports.io (API-Football) team ID.
$teams = @{
  'real-madrid'                = 541
  'barcelona'                  = 529
  'manchester-united'          = 33
  'manchester-city'            = 50
  'liverpool'                  = 40
  'arsenal'                    = 42
  'chelsea'                    = 49
  'bayern-munchen'             = 157
  'juventus'                   = 496
  'ac-milan'                   = 489
  'inter'                      = 505
  'psg'                        = 85
  'ajax'                       = 194
  'borussia-dortmund'          = 165
  'atletico-madrid'            = 530
  'tottenham'                  = 47
  'napoli'                     = 492
  'as-roma'                    = 497
  'lazio'                      = 487
  'sevilla'                    = 536
  'valencia'                   = 532
  'rb-leipzig'                 = 173
  'bayer-leverkusen'           = 168
  'porto'                      = 212
  'benfica'                    = 211
  'sporting-cp'                = 228
  'psv'                        = 197
  'feyenoord'                  = 209
  'everton'                    = 45
  'newcastle'                  = 34
  'west-ham'                   = 48
  'aston-villa'                = 66
  'marseille'                  = 81
  'lyon'                       = 80
  'celtic'                     = 247
  'rangers'                    = 257
  'schalke-04'                 = 174
  'villarreal'                 = 533
  'real-sociedad'              = 548
  'athletic-bilbao'            = 531
  'real-betis'                 = 543
  'fiorentina'                 = 502
  'atalanta'                   = 499
  'wolfsburg'                  = 161
  'eintracht-frankfurt'        = 169
  'borussia-monchengladbach'   = 163
  'az-alkmaar'                 = 201
  'club-brugge'                = 569
  'anderlecht'                 = 554
  'shakhtar-donetsk'           = 550
  'galatasaray'                = 645
  'fenerbahce'                 = 611
  'olympiacos'                 = 553
}

$outDir = "c:\Users\Ruben\Documents\Game app\football"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$ok = 0; $fail = 0; $failed = @()
foreach ($slug in $teams.Keys) {
  $id = $teams[$slug]
  $url = "https://media.api-sports.io/football/teams/$id.png"
  $dest = Join-Path $outDir "$slug.png"
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 30
    $size = (Get-Item $dest).Length
    # Verify PNG magic bytes and size > 1KB
    $bytes = [System.IO.File]::ReadAllBytes($dest)
    $isPng = $bytes.Length -ge 8 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47
    if ($isPng -and $size -gt 1024) {
      Write-Host ("OK   {0,-28} {1,8} bytes" -f $slug, $size)
      $ok++
    } else {
      Write-Host ("BAD  {0,-28} not a valid PNG or too small ({1} bytes)" -f $slug, $size)
      Remove-Item $dest -Force
      $fail++; $failed += $slug
    }
  } catch {
    Write-Host ("ERR  {0,-28} {1}" -f $slug, $_.Exception.Message)
    if (Test-Path $dest) { Remove-Item $dest -Force }
    $fail++; $failed += $slug
  }
  Start-Sleep -Milliseconds 250
}

Write-Host ""
Write-Host "Downloaded OK: $ok  Failed: $fail"
if ($failed.Count -gt 0) { Write-Host ("Failed clubs: " + ($failed -join ", ")) }
