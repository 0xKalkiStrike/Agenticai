# Test logging in as different users to find developers
$API_BASE = "http://127.0.0.1:8000"

$testUsers = @(
    "Neha_2005",
    "Sakshi_2004", 
    "Krishna",
    "Nilesh",
    "deep_2004",
    "Admin"
)

Write-Host "Testing login for each user to check their roles:" -ForegroundColor Yellow

foreach ($username in $testUsers) {
    # Try common passwords
    $passwords = @("password123", "admin123", "password", "123456", $username.ToLower())
    
    foreach ($password in $passwords) {
        try {
            $loginBody = @{
                username = $username
                password = $password
            } | ConvertTo-Json
            
            $loginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
            
            if ($loginResponse.StatusCode -eq 200) {
                $loginData = $loginResponse.Content | ConvertFrom-Json
                Write-Host "SUCCESS: $username / $password -> Role: $($loginData.role)" -ForegroundColor Green
                
                # If this is a developer, test their endpoints
                if ($loginData.role -eq "developer") {
                    Write-Host "  Testing developer endpoints..." -ForegroundColor Cyan
                    
                    $headers = @{
                        "Authorization" = "Bearer $($loginData.token)"
                        "Content-Type" = "application/json"
                    }
                    
                    try {
                        $assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $headers
                        $assignedData = $assignedResponse.Content | ConvertFrom-Json
                        Write-Host "    Assigned tickets: $($assignedData.assigned_tickets.Count)" -ForegroundColor White
                    } catch {
                        Write-Host "    Assigned tickets failed: $($_.Exception.Message)" -ForegroundColor Red
                    }
                    
                    try {
                        $availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $headers
                        $availableData = $availableResponse.Content | ConvertFrom-Json
                        Write-Host "    Available tickets: $($availableData.available_tickets.Count)" -ForegroundColor White
                    } catch {
                        Write-Host "    Available tickets failed: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
                break
            }
        } catch {
            # Silently continue to next password
        }
    }
}