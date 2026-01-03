# PowerShell script to test the ticket API
$API_BASE = "http://127.0.0.1:8000"

Write-Host "=== Testing Ticket API ===" -ForegroundColor Green

# Test health
Write-Host "Testing health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$API_BASE/health" -Method GET
    Write-Host "Health Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    $healthData = $healthResponse.Content | ConvertFrom-Json
    Write-Host "Database: $($healthData.database)" -ForegroundColor Green
} catch {
    Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Try to get all tickets (without auth first)
Write-Host "Checking for existing tickets..." -ForegroundColor Yellow
try {
    $ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET
    Write-Host "Tickets Status: $($ticketsResponse.StatusCode)" -ForegroundColor Green
    $ticketsData = $ticketsResponse.Content | ConvertFrom-Json
    $ticketCount = $ticketsData.tickets.Count
    Write-Host "Found $ticketCount tickets in system" -ForegroundColor Green
    
    if ($ticketCount -gt 0) {
        Write-Host "Sample tickets found:" -ForegroundColor Cyan
        $ticketsData.tickets | Select-Object -First 3 | ForEach-Object {
            Write-Host "  - ID: $($_.id), Query: $($_.query.Substring(0, [Math]::Min(50, $_.query.Length)))..." -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Could not get tickets: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "This might be due to authentication requirements" -ForegroundColor Yellow
}

# Try to login as different users to test authentication
$testUsers = @(
    @{username="admin"; password="admin123"},
    @{username="client1"; password="password123"},
    @{username="developer1"; password="password123"},
    @{username="testuser"; password="password"}
)

Write-Host "Testing login with different users..." -ForegroundColor Yellow
$validToken = $null
$validUser = $null

foreach ($user in $testUsers) {
    try {
        $loginBody = @{
            username = $user.username
            password = $user.password
        } | ConvertTo-Json
        
        $loginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
        
        if ($loginResponse.StatusCode -eq 200) {
            $loginData = $loginResponse.Content | ConvertFrom-Json
            Write-Host "Login successful for $($user.username) (Role: $($loginData.role))" -ForegroundColor Green
            $validToken = $loginData.token
            $validUser = $user.username
            break
        }
    } catch {
        Write-Host "Login failed for $($user.username): $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($validToken) {
    Write-Host "Testing authenticated endpoints with $validUser..." -ForegroundColor Yellow
    
    # Test developer endpoints
    $headers = @{
        "Authorization" = "Bearer $validToken"
        "Content-Type" = "application/json"
    }
    
    try {
        $devTicketsResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $headers
        $devTicketsData = $devTicketsResponse.Content | ConvertFrom-Json
        Write-Host "Developer assigned tickets: $($devTicketsData.assigned_tickets.Count)" -ForegroundColor Cyan
    } catch {
        Write-Host "Developer tickets endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    try {
        $availableTicketsResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $headers
        $availableTicketsData = $availableTicketsResponse.Content | ConvertFrom-Json
        Write-Host "Available tickets: $($availableTicketsData.available_tickets.Count)" -ForegroundColor Cyan
    } catch {
        Write-Host "Available tickets endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test admin endpoints if user has access
    try {
        $allTicketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $headers
        $allTicketsData = $allTicketsResponse.Content | ConvertFrom-Json
        Write-Host "All tickets (authenticated): $($allTicketsData.tickets.Count)" -ForegroundColor Cyan
    } catch {
        Write-Host "Admin tickets endpoint failed (expected if not admin): $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "No valid login found. Cannot test authenticated endpoints." -ForegroundColor Red
}

Write-Host "=== Test Complete ===" -ForegroundColor Green