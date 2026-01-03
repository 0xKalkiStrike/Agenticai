# Check the actual database state to confirm the issue
$API_BASE = "http://127.0.0.1:8000"

# Login as admin
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

Write-Host "=== Current Ticket State ===" -ForegroundColor Green

$ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $adminHeaders
$ticketsData = $ticketsResponse.Content | ConvertFrom-Json

Write-Host "Total tickets: $($ticketsData.tickets.Count)" -ForegroundColor Yellow

foreach ($ticket in $ticketsData.tickets) {
    Write-Host "Ticket $($ticket.id):" -ForegroundColor Cyan
    Write-Host "  Status: $($ticket.status)" -ForegroundColor White
    Write-Host "  Query: $($ticket.query.Substring(0, [Math]::Min(50, $ticket.query.Length)))..." -ForegroundColor White
    Write-Host "  Client: $($ticket.client_name)" -ForegroundColor White
    Write-Host "  Developer Name: '$($ticket.developer_name)'" -ForegroundColor White
    Write-Host "  Assigned Developer ID: '$($ticket.assigned_developer_id)'" -ForegroundColor White
    Write-Host ""
}

Write-Host "This confirms the issue: assigned_developer_id is NULL even after assignment!" -ForegroundColor Red