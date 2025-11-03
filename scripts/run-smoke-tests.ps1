param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

function Log($msg) { Write-Host $msg }
function LogOk($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function LogErr($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Exec(& $scriptblock) {
  & $scriptblock
}

function Check-DockerAvailable {
  try {
    docker version > $null 2>&1
    return $true
  } catch {
    return $false
  }
}

function Wait-ForHttp {
  param($url, $timeoutSec = 60, $intervalSec = 2)
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Method GET -Uri $url -TimeoutSec 5 -ErrorAction Stop
      return @{ ok = $true; status = $resp.StatusCode; body = $resp.Content }
    } catch {
      Start-Sleep -Seconds $intervalSec
    }
  }
  return @{ ok = $false; error = "Timeout waiting for $url" }
}

function Parse-IdFromResponse($obj) {
  if ($null -ne $obj._id) { return $obj._id }
  if ($null -ne $obj.id) { return $obj.id }
  if ($null -ne $obj._id.'$oid') { return $obj._id.'$oid' }
  return $null
}

function Run-Tests {
  $results = @()

  # 1) healthz
  Log "Checking /healthz..."
  $h = Wait-ForHttp -url 'http://localhost/healthz' -timeoutSec 30
  if ($h.ok -and $h.status -eq 200) { LogOk '/healthz returned 200'; $results += @{name='healthz'; ok=$true} }
  else { LogErr "/healthz failed: $($h.error)"; $results += @{name='healthz'; ok=$false; err=$h.error} }

  # 2) Create product
  Log "Creating product..."
  try {
    $prodBody = @{ name='SmokeProd'; price=1; stock=10 }
    $prod = Invoke-RestMethod -Method Post -Uri 'http://localhost/products' -ContentType 'application/json' -Body ($prodBody | ConvertTo-Json) -TimeoutSec 10
    $productId = Parse-IdFromResponse $prod
    if ($productId) { LogOk "Product created: $productId"; $results += @{name='create_product'; ok=$true; id=$productId} }
    else { LogErr "Product response missing id"; $results += @{name='create_product'; ok=$false; resp=$prod} }
  } catch {
    LogErr "Create product failed: $_"; $results += @{name='create_product'; ok=$false; err=$_.Exception.Message}
  }

  # 3) Create customer (CQRS)
  Log "Creating customer (CQRS)..."
  try {
    $custBody = @{ name='SmokeCust'; email='smoke@example.com' }
    $cust = Invoke-RestMethod -Method Post -Uri 'http://localhost/customers/commands' -ContentType 'application/json' -Body ($custBody | ConvertTo-Json) -TimeoutSec 10
    $customerId = Parse-IdFromResponse $cust
    if ($customerId) { LogOk "Customer created: $customerId"; $results += @{name='create_customer'; ok=$true; id=$customerId} }
    else { LogErr "Customer response missing id"; $results += @{name='create_customer'; ok=$false; resp=$cust} }
  } catch {
    LogErr "Create customer failed: $_"; $results += @{name='create_customer'; ok=$false; err=$_.Exception.Message}
  }

  # 4) Create order (depends on above ids)
  Log "Creating order..."
  try {
    $pid = $productId
    $cid = $customerId
    if (-not $pid -or -not $cid) { throw "Missing productId or customerId (productId=$pid, customerId=$cid)" }
    $orderBody = @{ customerId = $cid; items = @(@{ productId = $pid; quantity = 1 }) }
    $ord = Invoke-RestMethod -Method Post -Uri 'http://localhost/orders' -ContentType 'application/json' -Body ($orderBody | ConvertTo-Json -Depth 5) -TimeoutSec 20
    $orderId = Parse-IdFromResponse $ord
    if ($orderId) { LogOk "Order created: $orderId"; $results += @{name='create_order'; ok=$true; id=$orderId} }
    else { LogErr "Order response missing id"; $results += @{name='create_order'; ok=$false; resp=$ord} }
  } catch {
    LogErr "Create order failed: $_"; $results += @{name='create_order'; ok=$false; err=$_.Exception.Message}
  }

  # 5) List endpoints
  Log "Listing products..."
  try { $prods = Invoke-RestMethod -Method Get -Uri 'http://localhost/products' -TimeoutSec 10; LogOk "Products listed: $($prods.Count)"; $results += @{name='list_products'; ok=$true; count=$prods.Count} } catch { LogErr "List products failed: $_"; $results += @{name='list_products'; ok=$false; err=$_.Exception.Message} }

  Log "Listing customers (queries)..."
  try { $custs = Invoke-RestMethod -Method Get -Uri 'http://localhost/customers/queries' -TimeoutSec 10; LogOk "Customers listed: $($custs.Count)"; $results += @{name='list_customers'; ok=$true; count=$custs.Count} } catch { LogErr "List customers failed: $_"; $results += @{name='list_customers'; ok=$false; err=$_.Exception.Message} }

  Log "Listing orders..."
  try { $ords = Invoke-RestMethod -Method Get -Uri 'http://localhost/orders' -TimeoutSec 10; LogOk "Orders listed: $($ords.Count)"; $results += @{name='list_orders'; ok=$true; count=$ords.Count} } catch { LogErr "List orders failed: $_"; $results += @{name='list_orders'; ok=$false; err=$_.Exception.Message} }

  return $results
}

function Print-Summary($results) {
  Write-Host "`n=== Summary ===" -ForegroundColor Cyan
  $failed = $results | Where-Object { -not $_.ok }
  if ($failed.Count -eq 0) { Write-Host "All checks passed" -ForegroundColor Green; return }
  Write-Host "Some checks failed:" -ForegroundColor Red
  foreach ($f in $failed) {
    Write-Host " - $($f.name):" -NoNewline; if ($f.err) { Write-Host " $($f.err)" -ForegroundColor Red } elseif ($f.resp) { Write-Host " unexpected response" -ForegroundColor Yellow } else { Write-Host " failed" -ForegroundColor Red }
  }
}

### Main
if (-not (Check-DockerAvailable)) {
  LogErr "Docker doesn't seem available. Start Docker Desktop and re-run this script."
  exit 1
}

if (-not $SkipBuild) {
  Log "Running docker-compose up -d --build..."
  try {
    docker-compose up -d --build | Write-Host
  } catch {
    LogErr "docker-compose up failed: $_"; exit 1
  }
}

Log "Waiting for nginx /healthz to be available..."
$health = Wait-ForHttp -url 'http://localhost/healthz' -timeoutSec 60
if (-not $health.ok) { LogErr "/healthz did not become available: $($health.error)"; exit 1 }

Log "Validating nginx configuration inside container..."
try {
  docker exec ecommerce_nginx nginx -t 2>&1 | Write-Host
} catch {
  LogErr "nginx -t failed or container not available: $_"; # continue to tests anyway
}

$results = Run-Tests
Print-Summary $results
