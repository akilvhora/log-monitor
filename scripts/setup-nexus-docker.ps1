# =============================================================
# Setup Nexus Docker Hosted Repository
# Run this on the server (192.168.1.111) as Administrator
# =============================================================

$NEXUS_URL = "http://localhost:8081"
$NEXUS_USER = "admin"
$NEXUS_PASS = "admin@123"
$DOCKER_PORT = 8082

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${NEXUS_USER}:${NEXUS_PASS}"))
}

# Step 1: Check Nexus connectivity
Write-Host "`n=== Step 1: Check Nexus ===" -ForegroundColor Cyan
try {
    $status = Invoke-RestMethod -Uri "$NEXUS_URL/service/rest/v1/status" -Headers $headers -Method Get
    Write-Host "Nexus is running" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Cannot reach Nexus at $NEXUS_URL" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# Step 2: Check if docker-hosted repo exists
Write-Host "`n=== Step 2: Create Docker Hosted Repository ===" -ForegroundColor Cyan
try {
    $repo = Invoke-RestMethod -Uri "$NEXUS_URL/service/rest/v1/repositories/docker/hosted/docker-hosted" -Headers $headers -Method Get
    Write-Host "Docker hosted repository already exists" -ForegroundColor Yellow
} catch {
    Write-Host "Creating Docker hosted repository on port $DOCKER_PORT..."
    $body = @{
        name = "docker-hosted"
        online = $true
        storage = @{
            blobStoreName = "default"
            strictContentTypeValidation = $true
            writePolicy = "ALLOW"
        }
        docker = @{
            v1Enabled = $true
            forceBasicAuth = $false
            httpPort = $DOCKER_PORT
        }
    } | ConvertTo-Json -Depth 3

    try {
        Invoke-RestMethod -Uri "$NEXUS_URL/service/rest/v1/repositories/docker/hosted" -Headers $headers -Method Post -Body $body
        Write-Host "Docker hosted repository created on port $DOCKER_PORT" -ForegroundColor Green
    } catch {
        Write-Host "Failed to create repository: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 3: Enable Docker Bearer Token Realm
Write-Host "`n=== Step 3: Enable Docker Bearer Token Realm ===" -ForegroundColor Cyan
try {
    $realms = Invoke-RestMethod -Uri "$NEXUS_URL/service/rest/v1/security/realms/active" -Headers $headers -Method Get

    if ($realms -contains "DockerToken") {
        Write-Host "Docker Bearer Token Realm already active" -ForegroundColor Yellow
    } else {
        $realms += "DockerToken"
        $realmsJson = $realms | ConvertTo-Json
        Invoke-RestMethod -Uri "$NEXUS_URL/service/rest/v1/security/realms/active" -Headers $headers -Method Put -Body $realmsJson
        Write-Host "Docker Bearer Token Realm activated" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed to update realms: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Check if port 8082 is listening
Write-Host "`n=== Step 4: Verify Port $DOCKER_PORT ===" -ForegroundColor Cyan
$tcpTest = Test-NetConnection -ComputerName localhost -Port $DOCKER_PORT -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) {
    Write-Host "Port $DOCKER_PORT is listening" -ForegroundColor Green
} else {
    Write-Host "Port $DOCKER_PORT is NOT listening!" -ForegroundColor Red
    Write-Host "You may need to restart Nexus for the Docker connector to activate." -ForegroundColor Yellow
    Write-Host "Restart Nexus service, then re-run this script to verify." -ForegroundColor Yellow
}

# Step 5: Configure Docker Desktop insecure registry
Write-Host "`n=== Step 5: Docker Desktop Insecure Registry ===" -ForegroundColor Cyan
$daemonJsonPath = "$env:USERPROFILE\.docker\daemon.json"
if (Test-Path $daemonJsonPath) {
    $daemonJson = Get-Content $daemonJsonPath -Raw | ConvertFrom-Json
} else {
    $daemonJson = @{}
}

$registry = "192.168.1.111:$DOCKER_PORT"
$insecureRegs = @()
if ($daemonJson.'insecure-registries') {
    $insecureRegs = @($daemonJson.'insecure-registries')
}

if ($insecureRegs -contains $registry) {
    Write-Host "Insecure registry '$registry' already configured" -ForegroundColor Yellow
} else {
    $insecureRegs += $registry
    $daemonJson | Add-Member -NotePropertyName 'insecure-registries' -NotePropertyValue $insecureRegs -Force
    $daemonJson | ConvertTo-Json -Depth 3 | Set-Content $daemonJsonPath -Encoding UTF8
    Write-Host "Added '$registry' to insecure-registries in $daemonJsonPath" -ForegroundColor Green
    Write-Host "RESTART Docker Desktop for this to take effect!" -ForegroundColor Red
}

# Step 6: Test docker login
Write-Host "`n=== Step 6: Test Docker Login ===" -ForegroundColor Cyan
Write-Host "After Docker Desktop restarts, test with:"
Write-Host "  docker login -u $NEXUS_USER -p $NEXUS_PASS $registry" -ForegroundColor White

Write-Host "`n=== Done ===" -ForegroundColor Cyan
