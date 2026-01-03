# Debug ticket assignments and API responses
$API_BASE = "http://127.0.0.1:8000"

# Login as admin to check ticket status
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

Write-Host "=== ADMIN VIEW - All Tickets ===" -ForegroundColor Green
$ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $adminHeaders
$ticketsData = $ticketsResponse.Content | ConvertFrom-Json

foreach ($ticket in $ticketsData.tickets) {
    Write-Host "Ticket ID: $($ticket.id)" -ForegroundColor Yellow
    Write-Host "  Status: $($ticket.status)" -ForegroundColor White
    Write-Host "  Priority: $($ticket.priority)" -ForegroundColor White
    Write-Host "  Query: $($ticket.query)" -ForegroundColor White
    Write-Host "  Client: $($ticket.client_name)" -ForegroundColor White
    Write-Host "  Developer: '$($ticket.developer_name)'" -ForegroundColor White
    Write-Host "  Assigned Developer ID: $($ticket.assigned_developer_id)" -ForegroundColor White
    Write-Host ""
}

# Login as developer to check their view
Write-Host "=== DEVELOPER VIEW ===" -ForegroundColor Green
$devLoginBody = @{
    username = "testdev"
    password = "dev123"
} | ConvertTo-Json

$devLoginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $devLoginBody -ContentType "application/json"
$devLoginData = $devLoginResponse.Content | ConvertFrom-Json
$devToken = $devLoginData.token

Write-Host "Developer User ID: $($devLoginData.username)" -ForegroundColor Cyan

$devHeaders = @{
    "Authorization" = "Bearer $devToken"
    "Content-Type" = "application/json"
}

Write-Host "Raw API Responses:" -ForegroundColor Yellow

# Test my-assigned endpoint
try {
    $assignedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/my-assigned" -Method GET -Headers $devHeaders
    Write-Host "My-Assigned Response:" -ForegroundColor Cyan
    Write-Host $assignedResponse.Content -ForegroundColor White
} catch {
    Write-Host "My-Assigned Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test available endpoint  
try {
    $availableResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/available" -Method GET -Headers $devHeaders
    Write-Host "Available Response:" -ForegroundColor Cyan
    Write-Host $availableResponse.Content -ForegroundColor White
} catch {
    Write-Host "Available Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test completed endpoint
try {
    $completedResponse = Invoke-WebRequest -Uri "$API_BASE/developer/tickets/completed" -Method GET -Headers $devHeaders
    Write-Host "Completed Response:" -ForegroundColor Cyan
    Write-Host $completedResponse.Content -ForegroundColor White
} catch {
    Write-Host "Completed Error: $($_.Exception.Message)" -ForegroundColor Red
}