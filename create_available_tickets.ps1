# Create some unassigned tickets that developers can self-assign
$API_BASE = "http://127.0.0.1:8000"

# Login as admin to create tickets
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

# First, let's login as a client to create some tickets
Write-Host "Creating client user for ticket creation..." -ForegroundColor Yellow

$clientData = @{
    username = "testclient"
    password = "client123"
    email = "testclient@example.com"
    role = "client"
} | ConvertTo-Json

try {
    $createClientResponse = Invoke-WebRequest -Uri "$API_BASE/admin/users/create" -Method POST -Body $clientData -Headers $adminHeaders
    Write-Host "Client user created successfully" -ForegroundColor Green
} catch {
    Write-Host "Client creation failed (might already exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Login as client to create tickets
Write-Host "Logging in as client to create tickets..." -ForegroundColor Yellow

$clientLoginBody = @{
    username = "testclient"
    password = "client123"
} | ConvertTo-Json

try {
    $clientLoginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $clientLoginBody -ContentType "application/json"
    $clientLoginData = $clientLoginResponse.Content | ConvertFrom-Json
    $clientToken = $clientLoginData.token
    
    Write-Host "Client login successful! Role: $($clientLoginData.role)" -ForegroundColor Green
    
    $clientHeaders = @{
        "Authorization" = "Bearer $clientToken"
        "Content-Type" = "application/json"
    }
    
    # Create several tickets
    $ticketsToCreate = @(
        @{query="Website login page is broken"; priority="HIGH"},
        @{query="Dashboard loading is very slow"; priority="MEDIUM"},
        @{query="Email notifications not working"; priority="LOW"},
        @{query="API endpoints returning 500 errors"; priority="HIGH"},
        @{query="User profile page has display issues"; priority="MEDIUM"}
    )
    
    Write-Host "Creating tickets..." -ForegroundColor Yellow
    
    foreach ($ticketData in $ticketsToCreate) {
        $ticketJson = $ticketData | ConvertTo-Json
        
        try {
            $createTicketResponse = Invoke-WebRequest -Uri "$API_BASE/client/tickets/create" -Method POST -Body $ticketJson -Headers $clientHeaders
            $createTicketData = $createTicketResponse.Content | ConvertFrom-Json
            Write-Host "  Created: $($ticketData.query) (Priority: $($ticketData.priority))" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to create ticket: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "Client login failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Now check what tickets are available for developers
Write-Host "Checking available tickets for developers..." -ForegroundColor Yellow

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

try {
    $availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
    $availableData = $availableResponse.Content | ConvertFrom-Json
    
    Write-Host "Available tickets for developer: $($availableData.available_tickets.Count)" -ForegroundColor Cyan
    
    if ($availableData.available_tickets.Count -gt 0) {
        Write-Host "Sample available tickets:" -ForegroundColor White
        foreach ($ticket in $availableData.available_tickets) {
            Write-Host "  - ID: $($ticket.id), Priority: $($ticket.priority), Query: $($ticket.query)" -ForegroundColor Gray
        }
        
        # Self-assign the first ticket
        $firstTicket = $availableData.available_tickets[0]
        Write-Host "Self-assigning ticket $($firstTicket.id)..." -ForegroundColor Yellow
        
        try {
            $selfAssignResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/$($firstTicket.id)/self-assign" -Method POST -Headers $devHeaders
            Write-Host "Self-assignment successful!" -ForegroundColor Green
            
            # Check assigned tickets now
            $assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $devHeaders
            $assignedData = $assignedResponse.Content | ConvertFrom-Json
            Write-Host "Now have $($assignedData.assigned_tickets.Count) assigned tickets" -ForegroundColor Cyan
            
        } catch {
            Write-Host "Self-assignment failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "Failed to get available tickets: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "=== Final Status Check ===" -ForegroundColor Green

# Check all endpoints one more time
try {
    $assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $devHeaders
    $assignedData = $assignedResponse.Content | ConvertFrom-Json
    Write-Host "Assigned tickets: $($assignedData.assigned_tickets.Count)" -ForegroundColor White
} catch {
    Write-Host "Assigned tickets error: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
    $availableData = $availableResponse.Content | ConvertFrom-Json
    Write-Host "Available tickets: $($availableData.available_tickets.Count)" -ForegroundColor White
} catch {
    Write-Host "Available tickets error: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $completedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/completed" -Method GET -Headers $devHeaders
    $completedData = $completedResponse.Content | ConvertFrom-Json
    Write-Host "Completed tickets: $($completedData.tickets.Count)" -ForegroundColor White
} catch {
    Write-Host "Completed tickets error: $($_.Exception.Message)" -ForegroundColor Red
}