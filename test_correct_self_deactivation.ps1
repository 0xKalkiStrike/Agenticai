# Test self-deactivation prevention correctly
$API_BASE_URL = "http://127.0.0.1:8000"

# Login as Admin (ID: 1)
$loginData = @{
    username = "Admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_BASE_URL/login" -Method Post -Body $loginData -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "Logged in as: $($loginResponse.username) with role: $($loginResponse.role)"
} catch {
    Write-Host "Login failed, trying with 'admin' username..."
    
    $loginData = @{
        username = "admin"
        password = "admin123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$API_BASE_URL/login" -Method Post -Body $loginData -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "Logged in as: $($loginResponse.username) with role: $($loginResponse.role)"
}

# Get current user info by checking all users and finding the one that matches our login
$headers = @{ "Authorization" = "Bearer $token" }
$usersResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/all" -Method Get -Headers $headers
$users = $usersResponse.users

# Find the admin user we're logged in as
$currentAdminUser = $users | Where-Object { $_.username -eq $loginResponse.username -and $_.role -eq "admin" }

if ($currentAdminUser) {
    Write-Host "Current admin user ID: $($currentAdminUser.id), Username: $($currentAdminUser.username)"
    
    # Test self-deactivation (should fail)
    Write-Host ""
    Write-Host "Testing self-deactivation (should be prevented)..."
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$($currentAdminUser.id)/deactivate" -Method Post -Headers $headers
        Write-Host "ERROR: Self-deactivation succeeded when it should have failed!" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json)"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "SUCCESS: Self-deactivation correctly prevented (403 Forbidden)" -ForegroundColor Green
        } else {
            Write-Host "Unexpected error: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    # Test deactivating another admin user (should succeed)
    $otherAdminUser = $users | Where-Object { $_.role -eq "admin" -and $_.id -ne $currentAdminUser.id } | Select-Object -First 1
    
    if ($otherAdminUser) {
        Write-Host ""
        Write-Host "Testing deactivation of another admin user (should succeed)..."
        Write-Host "Target: ID $($otherAdminUser.id), Username: $($otherAdminUser.username), Current status: $($otherAdminUser.is_active)"
        
        try {
            $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$($otherAdminUser.id)/deactivate" -Method Post -Headers $headers
            Write-Host "SUCCESS: Other admin deactivation worked" -ForegroundColor Green
            Write-Host "Response: $($response.message)"
        } catch {
            Write-Host "Failed to deactivate other admin: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "Could not find current admin user in user list" -ForegroundColor Red
}