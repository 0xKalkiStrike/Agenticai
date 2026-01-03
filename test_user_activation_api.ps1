# PowerShell script to test User Management Actions API endpoints

$API_BASE_URL = "http://127.0.0.1:8000"

Write-Host "Starting User Management Actions API Tests" -ForegroundColor Green
Write-Host ""

# Test 1: Login as admin
Write-Host "Testing admin login..." -ForegroundColor Yellow

$loginData = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_BASE_URL/login" -Method Post -Body $loginData -ContentType "application/json"
    Write-Host "Login successful! Role: $($loginResponse.role)" -ForegroundColor Green
    $token = $loginResponse.token
} catch {
    Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Get all users
Write-Host ""
Write-Host "Getting all users..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $usersResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/all" -Method Get -Headers $headers
    $users = $usersResponse.users
    Write-Host "Found $($users.Count) users" -ForegroundColor Green
    
    # Find a non-admin user for testing
    $testUser = $users | Where-Object { $_.role -ne "admin" } | Select-Object -First 1
    
    if ($testUser) {
        Write-Host "Test user: $($testUser.username) (ID: $($testUser.id), Active: $($testUser.is_active))" -ForegroundColor Cyan
    } else {
        Write-Host "No non-admin users found for testing" -ForegroundColor Yellow
        $testUser = $null
    }
} catch {
    Write-Host "Failed to get users: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: User activation/deactivation
if ($testUser) {
    $userId = $testUser.id
    $username = $testUser.username
    $initialStatus = $testUser.is_active
    
    if ($initialStatus) {
        # User is active, test deactivation then activation
        Write-Host ""
        Write-Host "Testing user deactivation for $username (ID: $userId)..." -ForegroundColor Yellow
        
        try {
            $deactivateResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$userId/deactivate" -Method Post -Headers $headers
            Write-Host "Deactivation successful: $($deactivateResponse.message)" -ForegroundColor Green
            Write-Host "   User active status: $($deactivateResponse.user.isActive)" -ForegroundColor Gray
        } catch {
            Write-Host "Deactivation failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Testing user activation for $username (ID: $userId)..." -ForegroundColor Yellow
        
        try {
            $activateResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$userId/activate" -Method Post -Headers $headers
            Write-Host "Activation successful: $($activateResponse.message)" -ForegroundColor Green
            Write-Host "   User active status: $($activateResponse.user.isActive)" -ForegroundColor Gray
        } catch {
            Write-Host "Activation failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        # User is inactive, test activation then deactivation
        Write-Host ""
        Write-Host "Testing user activation for $username (ID: $userId)..." -ForegroundColor Yellow
        
        try {
            $activateResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$userId/activate" -Method Post -Headers $headers
            Write-Host "Activation successful: $($activateResponse.message)" -ForegroundColor Green
            Write-Host "   User active status: $($activateResponse.user.isActive)" -ForegroundColor Gray
        } catch {
            Write-Host "Activation failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Testing user deactivation for $username (ID: $userId)..." -ForegroundColor Yellow
        
        try {
            $deactivateResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$userId/deactivate" -Method Post -Headers $headers
            Write-Host "Deactivation successful: $($deactivateResponse.message)" -ForegroundColor Green
            Write-Host "   User active status: $($deactivateResponse.user.isActive)" -ForegroundColor Gray
        } catch {
            Write-Host "Deactivation failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 4: Self-deactivation prevention
Write-Host ""
Write-Host "Testing self-deactivation prevention..." -ForegroundColor Yellow

# Find admin user ID
$adminUser = $users | Where-Object { $_.role -eq "admin" } | Select-Object -First 1

if ($adminUser) {
    try {
        $selfDeactivateResponse = Invoke-RestMethod -Uri "$API_BASE_URL/admin/users/$($adminUser.id)/deactivate" -Method Post -Headers $headers
        Write-Host "Self-deactivation should be prevented but succeeded" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "Self-deactivation correctly prevented (403 Forbidden)" -ForegroundColor Green
        } else {
            Write-Host "Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No admin user found for self-deactivation test" -ForegroundColor Red
}

Write-Host ""
Write-Host "All tests completed!" -ForegroundColor Green