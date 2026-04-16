param(
    [string]$JenkinsUrl   = "http://192.168.1.111:8080",
    [string]$Username     = "admin",
    [string]$Password     = "admin@123",
    [string]$JobName      = "log-monitor",
    # Remote machine credentials (arvatech\administrator) for direct git config via WinRM
    [string]$RemoteHost   = "192.168.1.111",
    [string]$RemoteUser   = "arvatech\administrator",
    [string]$RemotePass   = "admin@123"
)

$ErrorActionPreference = "Stop"

# Shared session so the crumb cookie is reused across all requests
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-Jenkins {
    param(
        [string]    $Uri,
        [string]    $Method      = "GET",
        [string]    $Body,
        [string]    $ContentType,
        [hashtable] $ExtraHeaders = @{}
    )
    $bytes  = [Text.Encoding]::ASCII.GetBytes("${Username}:${Password}")
    $base64 = [Convert]::ToBase64String($bytes)
    $headers = @{ Authorization = "Basic $base64" }
    foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }

    $p = @{
        Uri             = $Uri
        Method          = $Method
        Headers         = $headers
        WebSession      = $Session          # reuse session / cookies
        UseBasicParsing = $true
    }
    if ($Body)        { $p['Body']        = $Body }
    if ($ContentType) { $p['ContentType'] = $ContentType }

    Invoke-WebRequest @p
}

# 1. Ping Jenkins
Write-Host "Connecting to Jenkins at $JenkinsUrl ..."
try {
    $ping = Invoke-Jenkins -Uri "$JenkinsUrl/api/json"
    Write-Host "  OK. Version: $($ping.Headers['X-Jenkins'])"
} catch {
    Write-Error "Cannot reach Jenkins: $_"
    exit 1
}

# 2. Fetch CSRF crumb (session cookie is stored automatically in $Session)
Write-Host "Fetching CSRF crumb ..."
$crumbHeader = @{}
try {
    $r    = Invoke-Jenkins -Uri "$JenkinsUrl/crumbIssuer/api/json"
    $data = $r.Content | ConvertFrom-Json
    $crumbHeader[$data.crumbRequestField] = $data.crumb
    Write-Host "  Crumb OK ($($data.crumbRequestField) = $($data.crumb))"
} catch {
    Write-Warning "Crumb endpoint unavailable - continuing without crumb."
}

# 3. Add Git credentials to Jenkins (for repo checkout)
Write-Host "Adding Git credentials to Jenkins ..."
$gitCredJson = @{
    "" = "0"
    credentials = @{
        scope = "GLOBAL"
        id = "git-credentials"
        username = $Username
        password = $Password
        description = "Git repository credentials"
        '$class' = "com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl"
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-Jenkins -Uri "$JenkinsUrl/credentials/store/system/domain/_/createCredentials" `
        -Method POST `
        -Body "json=$([Uri]::EscapeDataString($gitCredJson))" `
        -ContentType "application/x-www-form-urlencoded" `
        -ExtraHeaders $crumbHeader | Out-Null
    Write-Host "  Git credentials added."
} catch {
    Write-Host "  Git credentials already exist or failed: $($_.Exception.Message)"
}

# 4. Ensure Docker is running on the Jenkins server via WinRM
Write-Host "Checking Docker on $RemoteHost ..."
try {
    $secPass    = ConvertTo-SecureString $RemotePass -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($RemoteUser, $secPass)

    Invoke-Command -ComputerName $RemoteHost -Credential $credential -ScriptBlock {
        $pipe = '\\.\pipe\docker_engine'
        if (Test-Path $pipe) {
            Write-Host "  Docker is already running."
        } else {
            Write-Host "  Docker not running - attempting to start ..."
            # Try Docker Engine (service)
            $svc = Get-Service -Name 'docker' -ErrorAction SilentlyContinue
            if ($svc) {
                Start-Service docker
                Start-Sleep -Seconds 10
                Write-Host "  Docker service started."
            } else {
                # Try Docker Desktop
                $ddPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
                if (Test-Path $ddPath) {
                    Start-Process $ddPath
                    Write-Host "  Docker Desktop launched - waiting 30s for daemon ..."
                    Start-Sleep -Seconds 30
                } else {
                    Write-Warning "  Docker not found on this machine. Install Docker Desktop or Docker Engine."
                }
            }
        }

                # Fix Docker MTU — packet fragmentation causes TLS bad-record-MAC on pulls.
        # Lower MTU from default 1500 to 1450 to avoid fragmentation through
        # firewalls/VPNs that reduce effective packet size.
        # Docker Desktop on Windows uses the user-profile location.
        # Docker Engine (non-Desktop) uses ProgramData. Try both.
        $ddPath   = "$env:USERPROFILE\.docker\daemon.json"
        $engPath  = "C:\ProgramData\Docker\config\daemon.json"
        $daemonCfgPath = if (Test-Path (Split-Path $ddPath)) { $ddPath } else { $engPath }
        $daemonCfg = @{
            mtu                        = 1400
            "max-concurrent-downloads" = 2
            "insecure-registries"      = @("192.168.1.111:8082")
        }

        if (Test-Path $daemonCfgPath) {
            $existing = Get-Content $daemonCfgPath -Raw | ConvertFrom-Json
            # Merge: keep existing keys, add/overwrite ours
            foreach ($k in $daemonCfg.Keys) {
                $existing | Add-Member -NotePropertyName $k -NotePropertyValue $daemonCfg[$k] -Force
            }
            $existing | ConvertTo-Json -Depth 10 | Set-Content $daemonCfgPath -Encoding UTF8
        } else {
            New-Item -ItemType Directory -Force -Path (Split-Path $daemonCfgPath) | Out-Null
            $daemonCfg | ConvertTo-Json | Set-Content $daemonCfgPath -Encoding UTF8
        }
        Write-Host "  Docker daemon.json updated (MTU=1400)."

        # Restart Docker service to apply daemon.json changes
        $svc = Get-Service -Name 'docker' -ErrorAction SilentlyContinue
        if ($svc) {
            Restart-Service docker -Force
            Start-Sleep -Seconds 8
            Write-Host "  Docker service restarted."
        } else {
            Write-Warning "  Docker Desktop detected - restart it manually to apply MTU change."
        }

        # Verify
        $result = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Docker OK."
        } else {
            Write-Warning "  Docker still not responding: $result"
        }
    }
} catch {
    Write-Warning "WinRM unavailable - start Docker manually on $RemoteHost : $_"
}

# 5. Fix Git network settings on the Jenkins server.
#    "bad record mac" / Schannel errors = TLS fragmentation or HTTP/2 corruption.
#    Applied two ways: directly via WinRM (most reliable), then via Script Console as backup.

$gitConfigs = @(
    @("http.sslBackend", "openssl"),    # use OpenSSL, not Windows Schannel
    @("http.version",    "HTTP/1.1"),   # disable HTTP/2 (prevents frame corruption)
    @("http.postBuffer", "524288000"),  # 500 MB buffer (prevents mid-stream truncation)
    @("http.sslVerify",  "true")        # keep SSL verification on
)

# -- 5a. Apply via PowerShell Remoting (WinRM) directly on the server machine --
Write-Host "Applying git config on $RemoteHost via WinRM as $RemoteUser ..."
try {
    $secPass    = ConvertTo-SecureString $RemotePass -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($RemoteUser, $secPass)

    Invoke-Command -ComputerName $RemoteHost -Credential $credential -ScriptBlock {
        param($configs)
        foreach ($cfg in $configs) {
            $key = $cfg[0]; $val = $cfg[1]
            git config --global $key $val
            Write-Host "  [WinRM] Set $key = $val"
        }
        # Show current http.* settings to confirm
        Write-Host "`n  --- git global http config ---"
        git config --global --list | Where-Object { $_ -match '^http\.' }
    } -ArgumentList (,$gitConfigs)

    Write-Host "  WinRM git config applied."
} catch {
    Write-Warning "  WinRM failed (check WinRM is enabled on $RemoteHost): $_"

    # -- 5b. Fallback: apply via Jenkins Script Console --
    Write-Host "  Falling back to Jenkins Script Console ..."
    foreach ($cfg in $gitConfigs) {
        $key = $cfg[0]; $val = $cfg[1]
        $groovy = "def p = [`"git`",`"config`",`"--global`",`"$key`",`"$val`"].execute(); p.waitFor(); println(p.text + p.err.text)"
        try {
            $r = Invoke-Jenkins -Uri "$JenkinsUrl/scriptText" -Method POST `
                -Body "script=$([Uri]::EscapeDataString($groovy))" `
                -ContentType "application/x-www-form-urlencoded" `
                -ExtraHeaders $crumbHeader
            Write-Host "  [Console] Set $key = $val  [$($r.StatusCode)]"
        } catch {
            Write-Warning "  [Console] Failed to set ${key}: $_"
        }
    }
}

# 6. Build job XML — inline pipeline script (Jenkinsfile embedded directly).
#    The Jenkinsfile uses an explicit `git` step with a parameterized URL,
#    so Jenkins never needs SCM config to clone the repo.
$repoRoot = Split-Path -Parent $PSScriptRoot
$jfPath   = Join-Path $repoRoot "Jenkinsfile"

if (-not (Test-Path $jfPath)) {
    Write-Error "Jenkinsfile not found at: $jfPath"
    exit 1
}

$raw = Get-Content $jfPath -Raw -Encoding UTF8
$raw = $raw -replace '&',  '&amp;'
$raw = $raw -replace '<',  '&lt;'
$raw = $raw -replace '>',  '&gt;'
$raw = $raw -replace '"',  '&quot;'
$raw = $raw -replace "'",  '&apos;'

$jobXml = '<?xml version="1.1" encoding="UTF-8"?>' + "`n" +
'<flow-definition plugin="workflow-job">' + "`n" +
'  <description>CI/CD pipeline for Log Monitor</description>' + "`n" +
'  <keepDependencies>false</keepDependencies>' + "`n" +
'  <properties>' + "`n" +
'    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty/>' + "`n" +
'    <jenkins.model.BuildDiscarderProperty>' + "`n" +
'      <strategy class="hudson.tasks.LogRotator">' + "`n" +
'        <daysToKeep>-1</daysToKeep>' + "`n" +
'        <numToKeep>10</numToKeep>' + "`n" +
'        <artifactDaysToKeep>-1</artifactDaysToKeep>' + "`n" +
'        <artifactNumToKeep>-1</artifactNumToKeep>' + "`n" +
'      </strategy>' + "`n" +
'    </jenkins.model.BuildDiscarderProperty>' + "`n" +
'  </properties>' + "`n" +
'  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps">' + "`n" +
"    <script>$raw</script>" + "`n" +
'    <sandbox>true</sandbox>' + "`n" +
'  </definition>' + "`n" +
'  <triggers/>' + "`n" +
'  <disabled>false</disabled>' + "`n" +
'</flow-definition>'

# 7. Create or update the job
Write-Host "Checking if job '$JobName' already exists ..."
$jobExists = $false
try {
    Invoke-Jenkins -Uri "$JenkinsUrl/job/$JobName/api/json" | Out-Null
    $jobExists = $true
    Write-Host "  Job exists - will update."
} catch {
    Write-Host "  Job not found - will create."
}

if ($jobExists) {
    $endpoint = "$JenkinsUrl/job/$JobName/config.xml"
    $verb = "Updating"
} else {
    $endpoint = "$JenkinsUrl/createItem?name=$([Uri]::EscapeDataString($JobName))"
    $verb = "Creating"
}

Write-Host "$verb job '$JobName' ..."
try {
    Invoke-Jenkins -Uri $endpoint -Method POST -Body $jobXml -ContentType "application/xml" -ExtraHeaders $crumbHeader | Out-Null
    Write-Host ""
    Write-Host "Done. Open: $JenkinsUrl/job/$JobName"
} catch {
    Write-Error "Failed: $_"
    exit 1
}
