# Check what users exist in the system
$API_BASE = "http://127.0.0.1:8000"

# Login as admin to get all users
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$API_BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.token
    
    Write-Host "Logged in as admin successfully" -ForegroundColor Green
    
    # Get all users
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $usersResponse = Invoke-WebRequest -Uri "$API_BASE/admin/users/all" -Method GET -Headers $headers
    $usersData = $usersResponse.Content | ConvertFrom-Json
    
    Write-Host "Users in system:" -ForegroundColor Yellow
    foreach ($role in $usersData.PSObject.Properties) {
        Write-Host "  $($role.Name):" -ForegroundColor Cyan
        foreach ($user in $role.Value) {
            Write-Host "    - $($user.username) (ID: $($user.id), Email: $($user.email))" -ForegroundColor White
        }
    }
    
    # Also get all tickets to see what's there
    $ticketsResponse = Invoke-WebRequest -Uri "$API_BASE/admin/tickets/all" -Method GET -Headers $headers
    $ticketsData = $ticketsResponse.Content | ConvertFrom-Json
    
    Write-Host "`nTickets in system:" -ForegroundColor Yellow
    foreach ($ticket in $ticketsData.tickets) {
        Write-Host "  - ID: $($ticket.id), Status: $($ticket.status), Priority: $($ticket.priority)" -ForegroundColor White
        Write-Host "    Query: $($ticket.query)" -ForegroundColor Gray
        Write-Host "    Client: $($ticket.client_name), Developer: $($ticket.developer_name)" -ForegroundColor Gray
        Write-Host ""
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}