# Fix ticket assignment issue
$API_BASE = "http://127.0.0.1:8000"

# Login as admin
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
$loginData = $loginResponse.Content | ConvertFrom-Json
$adminToken = $loginData.token

$adminHeaders = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

# Get all users to find the testdev user ID
Write-Host "Finding testdev user ID..." -ForegroundColor Yellow
$usersResponse = Invoke-WebRequest -Uri "$API_BASE/admin/users/all" -Method GET -Headers $adminHeaders
$usersData = $usersResponse.Content | ConvertFrom-Json

$testdevId = $null
foreach ($user in $usersData.users) {
    Write-Host "User: $($user.username) (ID: $($user.id))" -ForegroundColor Cyan
    if ($user.username -eq "testdev") {
        $testdevId = $user.id
        Write-Host "  -> Found testdev with ID: $testdevId" -ForegroundColor Green
    }
}

if (-not $testdevId) {
    Write-Host "testdev user not found!" -ForegroundColor Red
    exit 1
}

# Get tickets
$ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $adminHeaders
$ticketsData = $ticketsResponse.Content | ConvertFrom-Json

Write-Host "Attempting to assign tickets..." -ForegroundColor Yellow

foreach ($ticket in $ticketsData.tickets) {
    Write-Host "Assigning ticket $($ticket.id) to developer $testdevId..." -ForegroundColor Cyan
    
    $assignmentData = @{
        developer_id = [int]$testdevId
        notes = "Assigned for testing developer dashboard"
    } | ConvertTo-Json
    
    Write-Host "Assignment payload: $assignmentData" -ForegroundColor Gray
    
    try {
        $assignResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/$($ticket.id)/assign" -Method POST -Body $assignmentData -Headers $adminHeaders
        Write-Host "  SUCCESS: $($assignResponse.StatusCode)" -ForegroundColor Green
        Write-Host "  Response: $($assignResponse.Content)" -ForegroundColor White
    } catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        # Try to get more details from the error response
        if ($_.Exception.Response) {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "  Error details: $errorBody" -ForegroundColor Red
        }
    }
}

# Check if assignment worked
Write-Host "Checking assignment results..." -ForegroundColor Yellow
$ticketsResponse2 = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $adminHeaders
$ticketsData2 = $ticketsResponse2.Content | ConvertFrom-Json

foreach ($ticket in $ticketsData2.tickets) {
    Write-Host "Ticket $($ticket.id): Developer='$($ticket.developer_name)', ID=$($ticket.assigned_developer_id)" -ForegroundColor White
}

# Test developer endpoints again
Write-Host "Testing developer endpoints after assignment..." -ForegroundColor Yellow
$devLoginBody = @{
    username = "testdev"
    password = "dev123"
} | ConvertTo-Json

$devLoginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $devLoginBody -ContentType "application/json"
$devLoginData = $devLoginResponse.Content | ConvertFrom-Json
$devToken = $devLoginData.token

$devHeaders = @{
    "Authorization" = "Bearer $devToken"
    "Content-Type" = "application/json"
}

$assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $devHeaders
$assignedData = $assignedResponse.Content | ConvertFrom-Json
Write-Host "Developer assigned tickets: $($assignedData.assigned_tickets.Count)" -ForegroundColor Cyan

$availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
$availableData = $availableResponse.Content | ConvertFrom-Json
Write-Host "Developer available tickets: $($availableData.available_tickets.Count)" -ForegroundColor Cyan