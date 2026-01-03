# Test script to verify deactivated users cannot login
$API_BASE = "http://127.0.0.1:8000"

Write-Host "Testing Deactivated User Login Prevention" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow

# Test 1: Try to login with a deactivated user
Write-Host "`n1. Testing login with deactivated user..." -ForegroundColor Cyan

$loginData = @{
    username = "test_deactivated_user"
    password = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_BASE/login" -Method POST -Body $loginData -ContentType "application/json"
    Write-Host "ERROR: Deactivated user was able to login! This should not happen." -ForegroundColor Red
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Response.StatusDescription
    
    if ($statusCode -eq 403) {
        Write-Host "SUCCESS: Deactivated user login blocked with 403 Forbidden" -ForegroundColor Green
        Write-Host "Status Code: $statusCode" -ForegroundColor Green
    } elseif ($statusCode -eq 401) {
        Write-Host "INFO: Login failed with 401 Unauthorized (could be invalid credentials or deactivated)" -ForegroundColor Yellow
        Write-Host "Status Code: $statusCode" -ForegroundColor Yellow
    } else {
        Write-Host "UNEXPECTED: Login failed with status code: $statusCode" -ForegroundColor Magenta
        Write-Host "Error: $errorMessage" -ForegroundColor Magenta
    }
}

# Test 2: Verify active user can still login
Write-Host "`n2. Testing login with active user..." -ForegroundColor Cyan

$activeLoginData = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_BASE/login" -Method POST -Body $activeLoginData -ContentType "application/json"
    Write-Host "SUCCESS: Active user can login normally" -ForegroundColor Green
    Write-Host "Token received: $($response.token.Substring(0, 20))..." -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "INFO: Active user login failed with status code: $statusCode" -ForegroundColor Yellow
    Write-Host "This might be expected if credentials are incorrect" -ForegroundColor Yellow
}

Write-Host "`nTest completed!" -ForegroundColor Yellow