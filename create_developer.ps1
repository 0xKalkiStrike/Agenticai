# Create a developer user and assign tickets for testing
$API_BASE = "http://127.0.0.1:8000"

# Login as admin
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $adminToken = $loginData.token
    
    Write-Host "Logged in as admin successfully" -ForegroundColor Green
    
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    # Create a developer user
    Write-Host "Creating developer user..." -ForegroundColor Yellow
    
    $developerData = @{
        username = "testdev"
        password = "dev123"
        email = "testdev@example.com"
        role = "developer"
    } | ConvertTo-Json
    
    try {
        $createResponse = Invoke-WebRequest -Uri "$API_BASE/admin/users/create" -Method POST -Body $developerData -Headers $headers
        Write-Host "Developer user created successfully" -ForegroundColor Green
    } catch {
        Write-Host "Developer creation failed (might already exist): $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Get all tickets to assign one to the developer
    $ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $headers
    $ticketsData = $ticketsResponse.Content | ConvertFrom-Json
    
    if ($ticketsData.tickets.Count -gt 0) {
        Write-Host "Assigning tickets to developer..." -ForegroundColor Yellow
        
        # Get the developer ID (try to find testdev or use one of the existing users)
        $usersResponse = Invoke-WebRequest -Uri "$API_BASE/admin/users/all" -Method GET -Headers $headers
        $usersData = $usersResponse.Content | ConvertFrom-Json
        
        # Find a developer user ID (try testdev first, then any user)
        $developerId = $null
        foreach ($user in $usersData.users) {
            if ($user.username -eq "testdev") {
                $developerId = $user.id
                break
            }
        }
        
        # If no testdev, use the first available user
        if (-not $developerId -and $usersData.users.Count -gt 1) {
            $developerId = $usersData.users[1].id  # Skip admin (first user)
            Write-Host "Using user ID $developerId as developer" -ForegroundColor Cyan
        }
        
        if ($developerId) {
            # Assign the first ticket to the developer
            $ticketId = $ticketsData.tickets[0].id
            
            $assignmentData = @{
                developer_id = $developerId
                notes = "Test assignment for developer dashboard"
            } | ConvertTo-Json
            
            try {
                $assignResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/$ticketId/assign" -Method POST -Body $assignmentData -Headers $headers
                Write-Host "Assigned ticket $ticketId to developer $developerId" -ForegroundColor Green
            } catch {
                Write-Host "Assignment failed: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "No suitable developer ID found" -ForegroundColor Red
        }
    }
    
    # Now test login as the developer
    Write-Host "Testing developer login..." -ForegroundColor Yellow
    
    $devLoginBody = @{
        username = "testdev"
        password = "dev123"
    } | ConvertTo-Json
    
    try {
        $devLoginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $devLoginBody -ContentType "application/json"
        $devLoginData = $devLoginResponse.Content | ConvertFrom-Json
        
        Write-Host "Developer login successful! Role: $($devLoginData.role)" -ForegroundColor Green
        
        # Test developer endpoints
        $devHeaders = @{
            "Authorization" = "Bearer $($devLoginData.token)"
            "Content-Type" = "application/json"
        }
        
        Write-Host "Testing developer endpoints..." -ForegroundColor Cyan
        
        try {
            $assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $devHeaders
            $assignedData = $assignedResponse.Content | ConvertFrom-Json
            Write-Host "  Assigned tickets: $($assignedData.assigned_tickets.Count)" -ForegroundColor White
            
            if ($assignedData.assigned_tickets.Count -gt 0) {
                Write-Host "  Sample assigned ticket:" -ForegroundColor Gray
                $ticket = $assignedData.assigned_tickets[0]
                Write-Host "    ID: $($ticket.id), Status: $($ticket.status), Query: $($ticket.query.Substring(0, [Math]::Min(50, $ticket.query.Length)))..." -ForegroundColor Gray
            }
        } catch {
            Write-Host "  Assigned tickets failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        try {
            $availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
            $availableData = $availableResponse.Content | ConvertFrom-Json
            Write-Host "  Available tickets: $($availableData.available_tickets.Count)" -ForegroundColor White
        } catch {
            Write-Host "  Available tickets failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "Developer login failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
}