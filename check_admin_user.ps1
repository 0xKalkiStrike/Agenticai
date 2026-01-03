# Check admin user details
$API_BASE_URL = "http://127.0.0.1:8000"

# Login
$loginData = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$API_BASE_URL/login" -Method Post -Body $loginData -ContentType "application/json"
$token = $loginResponse.token

Write-Host "Logged in as: $($loginResponse.username) with role: $($loginResponse.role)"

# Get users
$headers = @{ "Authorization" = "Bearer $token" }
$usersResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/all" -Method Get -Headers $headers
$users = $usersResponse.users

Write-Host "All users:"
$users | ForEach-Object {
    Write-Host "ID: $($_.id), Username: $($_.username), Role: $($_.role), Active: $($_.is_active)"
}

# Find admin user
$adminUsers = $users | Where-Object { $_.role -eq "admin" }
Write-Host ""
Write-Host "Admin users:"
$adminUsers | ForEach-Object {
    Write-Host "ID: $($_.id), Username: $($_.username)"
}

# Test self-deactivation with the first admin user
if ($adminUsers.Count -gt 0) {
    $adminUser = $adminUsers[0]
    Write-Host ""
    Write-Host "Testing self-deactivation for admin user ID: $($adminUser.id) (username: $($adminUser.username))"
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$($adminUser.id)/deactivate" -Method Post -Headers $headers
        Write-Host "ERROR: Self-deactivation succeeded when it should have failed!" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json)"
    } catch {
        Write-Host "SUCCESS: Self-deactivation prevented - $($_.Exception.Message)" -ForegroundColor Green
    }
}