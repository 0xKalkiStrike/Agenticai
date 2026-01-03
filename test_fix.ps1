# Test the assignment fix
$API_BASE = "http://127.0.0.1:8000"

Write-Host "=== Testing Assignment Fix ===" -ForegroundColor Green

# Login as developer
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

Write-Host "Logged in as developer: $($devLoginData.username)" -ForegroundColor Cyan

# Check available tickets
Write-Host "Checking available tickets..." -ForegroundColor Yellow
$availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
$availableData = $availableResponse.Content | ConvertFrom-Json
Write-Host "Available tickets: $($availableData.available_tickets.Count)" -ForegroundColor White

if ($availableData.available_tickets.Count -gt 0) {
    # Self-assign a ticket
    $ticketToAssign = $availableData.available_tickets[0]
    Write-Host "Self-assigning ticket $($ticketToAssign.id): $($ticketToAssign.query)" -ForegroundColor Yellow
    
    try {
        $selfAssignResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/$($ticketToAssign.id)/self-assign" -Method POST -Headers $devHeaders
        Write-Host "Self-assignment response: $($selfAssignResponse.Content)" -ForegroundColor Green
        
        # Now check assigned tickets
        Write-Host "Checking assigned tickets after self-assignment..." -ForegroundColor Yellow
        $assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $devHeaders
        $assignedData = $assignedResponse.Content | ConvertFrom-Json
        
        Write-Host "Assigned tickets: $($assignedData.assigned_tickets.Count)" -ForegroundColor Cyan
        
        if ($assignedData.assigned_tickets.Count -gt 0) {
            Write-Host "SUCCESS! Developer can now see assigned tickets:" -ForegroundColor Green
            foreach ($ticket in $assignedData.assigned_tickets) {
                Write-Host "  - ID: $($ticket.id), Status: $($ticket.status), Query: $($ticket.query.Substring(0, [Math]::Min(50, $ticket.query.Length)))..." -ForegroundColor White
            }
        } else {
            Write-Host "STILL BROKEN: Assigned tickets count is still 0" -ForegroundColor Red
        }
        
        # Check available tickets again (should be one less)
        $availableResponse2 = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
        $availableData2 = $availableResponse2.Content | ConvertFrom-Json
        Write-Host "Available tickets after assignment: $($availableData2.available_tickets.Count)" -ForegroundColor White
        
    } catch {
        Write-Host "Self-assignment failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "No available tickets to test with" -ForegroundColor Red
}

# Also check what admin sees
Write-Host "`n=== Admin View After Assignment ===" -ForegroundColor Green

$adminLoginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

$adminLoginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $adminLoginBody -ContentType "application/json"
$adminLoginData = $adminLoginResponse.Content | ConvertFrom-Json
$adminToken = $adminLoginData.token

$adminHeaders = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $adminHeaders
$ticketsData = $ticketsResponse.Content | ConvertFrom-Json

Write-Host "Admin view of all tickets:" -ForegroundColor Yellow
foreach ($ticket in $ticketsData.tickets | Select-Object -First 3) {
    Write-Host "  Ticket $($ticket.id): Status=$($ticket.status), Developer='$($ticket.developer_name)', AssignedID='$($ticket.assigned_developer_id)'" -ForegroundColor White
}