$ProgressPreference='SilentlyContinue'
$global:UA = @{'User-Agent'='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'; 'Accept-Language'='zh-CN,zh;q=0.9'}

function Get-Page([string]$url, [int]$retry = 4) {
  for ($i = 1; $i -le $retry; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -TimeoutSec 40 -UseBasicParsing -Headers $global:UA
      return $r.Content
    } catch {
      if ($i -eq $retry) { return "ERR:$($_.Exception.Message)" }
      Start-Sleep -Seconds (3 * $i)
    }
  }
}

function Get-Text([string]$html) {
  if ($html -like 'ERR:*') { return $html }
  $t = $html -replace '(?s)<script.*?</script>',' ' -replace '(?s)<style.*?</style>',' ' -replace '(?s)<!--.*?-->',' '
  $t = $t -replace '<br\s*/?>',"`n" -replace '</(p|div|tr|li|h1|h2|h3|h4|td)>',"`n"
  $t = $t -replace '<[^>]+>',' '
  $t = [System.Net.WebUtility]::HtmlDecode($t)
  $t = $t -replace '[ \t\u00a0]+',' '
  $t = ($t -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }) -join "`n"
  return $t
}

function Get-Links([string]$html, [string]$filter = '') {
  if ($html -like 'ERR:*') { return $html }
  $out = [regex]::Matches($html,'(?is)<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>') | ForEach-Object {
    $u = $_.Groups[1].Value
    $t = ([System.Net.WebUtility]::HtmlDecode(($_.Groups[2].Value -replace '<[^>]+>',''))).Trim()
    if ($t -ne '' -and ($filter -eq '' -or $t -match $filter)) { "$t  ==>  $u" }
  }
  return ($out | Select-Object -Unique)
}
