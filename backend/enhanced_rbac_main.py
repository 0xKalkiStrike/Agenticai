from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt, os
from typing import Optional, List

from enhanced_rbac_database import *

# ================= APP =================
app = FastAPI(title="Enhanced RBAC Ticketing System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ================= JWT =================
JWT_SECRET = "supersecretkey"
JWT_ALGO = "HS256"

def get_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(401, "Token missing")
    try:
        token = authorization.replace("Bearer ", "")
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except:
        raise HTTPException(401, "Invalid token")

def role_required(role: str):
    def checker(user=Depends(get_user)):
        if user["role"] != role:
            raise HTTPException(403, "Access denied")
        return user
    return checker

def admin_required(user=Depends(get_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user

def admin_or_pm_required(user=Depends(get_user)):
    if user["role"] not in ["admin", "project_manager"]:
        raise HTTPException(403, "Admin or Project Manager access required")
    return user

def developer_required(user=Depends(get_user)):
    if user["role"] != "developer":
        raise HTTPException(403, "Developer access required")
    return user

def client_required(user=Depends(get_user)):
    if user["role"] != "client":
        raise HTTPException(403, "Client access required")
    return user

# ================= MODELS =================
class Login(BaseModel):
    username: str
    password: str

class Register(BaseModel):
    username: str
    password: str
    email: str

class CreateUser(BaseModel):
    username: str
    password: str
    email: str
    role: str

class CreateTicket(BaseModel):
    query: str
    priority: str = "MEDIUM"

class AssignTicket(BaseModel):
    developer_id: int
    notes: Optional[str] = ""

class CompleteTicket(BaseModel):
    completion_notes: str

class PassTicket(BaseModel):
    reason: str

class CancelTicket(BaseModel):
    reason: str

class UpdateTicketStatus(BaseModel):
    status: str
    notes: Optional[str] = ""

class Reply(BaseModel):
    reply: str

# ================= AUTH =================
@app.post("/login")
def login(data: Login):
    user = authenticate_user(data.username, data.password)
    if not user:
        raise HTTPException(401, "Invalid credentials")

    token = jwt.encode(
        {"id": user["id"], "role": user["role"], "username": user["username"]},
        JWT_SECRET,
        algorithm=JWT_ALGO
    )
    return {"token": token, "role": user["role"], "username": user["username"]}

@app.post("/register")
def register(data: Register):
    try:
        register_client(data.username, data.password, data.email)
        return {"status": "registered", "message": "Client account created successfully"}
    except Exception as e:
        raise HTTPException(400, f"Registration failed: {str(e)}")

# ================= ADMIN ENDPOINTS =================
@app.get("/admin/dashboard")
def admin_dashboard(user=Depends(admin_required)):
    """Admin dashboard with complete system overview"""
    dashboard_data = get_admin_dashboard_data()
    return dashboard_data

@app.get("/admin/users/all")
def admin_get_all_users(user=Depends(admin_required)):
    """Get all users grouped by role"""
    users_by_role = get_users_by_role()
    return users_by_role

@app.get("/admin/users/developers")
def admin_get_developers(user=Depends(admin_required)):
    """Get all developers with their workload"""
    developers = get_developers_with_workload()
    return {"developers": developers}

@app.get("/admin/users/clients")
def admin_get_clients(user=Depends(admin_required)):
    """Get all clients with their ticket counts"""
    clients = get_clients_with_ticket_counts()
    return {"clients": clients}

@app.get("/admin/users/project_managers")
def admin_get_project_managers(user=Depends(admin_required)):
    """Get all project managers"""
    pms = get_project_managers()
    return {"project_managers": pms}

@app.post("/admin/users/create")
def admin_create_user(data: CreateUser, user=Depends(admin_required)):
    """Admin creates new user of any role"""
    try:
        user_id = create_user_by_admin(data.username, data.password, data.email, data.role, user["id"])
        return {"status": "created", "user_id": user_id, "message": f"{data.role.title()} created successfully"}
    except Exception as e:
        raise HTTPException(400, f"User creation failed: {str(e)}")

@app.get("/admin/tickets/all")
def admin_get_all_tickets(user=Depends(admin_required)):
    """Get all tickets with assignment details"""
    tickets = get_all_tickets_with_assignments()
    return {"tickets": tickets}

@app.post("/admin/tickets/{ticket_id}/assign")
def admin_assign_ticket(ticket_id: int, data: AssignTicket, user=Depends(admin_required)):
    """Admin assigns ticket to developer"""
    try:
        success = assign_ticket_to_developer(ticket_id, data.developer_id, user["id"], data.notes)
        if success:
            return {"status": "assigned", "message": "Ticket assigned successfully"}
        else:
            raise HTTPException(400, "Failed to assign ticket")
    except Exception as e:
        raise HTTPException(400, f"Assignment failed: {str(e)}")

@app.get("/admin/developer-performance")
def admin_get_developer_performance(period: str = "month", user=Depends(admin_required)):
    """Get developer performance metrics"""
    try:
        performance_data = get_developer_performance_data(period)
        return performance_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance data: {str(e)}")

# ================= PROJECT MANAGER ENDPOINTS =================
@app.get("/pm/dashboard")
def pm_dashboard(user=Depends(admin_or_pm_required)):
    """Project Manager dashboard"""
    dashboard_data = get_pm_dashboard_data()
    return dashboard_data

@app.get("/pm/developers")
def pm_get_developers(user=Depends(admin_or_pm_required)):
    """Get developers for assignment"""
    developers = get_available_developers()
    return {"developers": developers}

@app.post("/pm/tickets/{ticket_id}/assign")
def pm_assign_ticket(ticket_id: int, data: AssignTicket, user=Depends(admin_or_pm_required)):
    """Project Manager assigns ticket to developer"""
    try:
        success = assign_ticket_to_developer(ticket_id, data.developer_id, user["id"], data.notes)
        if success:
            return {"status": "assigned", "message": "Ticket assigned successfully"}
        else:
            raise HTTPException(400, "Failed to assign ticket")
    except Exception as e:
        raise HTTPException(400, f"Assignment failed: {str(e)}")

@app.get("/pm/tickets/unassigned")
def pm_get_unassigned_tickets(user=Depends(admin_or_pm_required)):
    """Get unassigned tickets for PM to assign"""
    tickets = get_unassigned_tickets()
    return {"tickets": tickets}

# ================= DEVELOPER ENDPOINTS =================
@app.get("/developer/dashboard")
def developer_dashboard(user=Depends(developer_required)):
    """Developer dashboard with personal data only"""
    dashboard_data = get_developer_dashboard_data(user["id"])
    return dashboard_data

@app.get("/developer/tickets/my-assigned")
def developer_get_my_tickets(user=Depends(developer_required)):
    """Get only tickets assigned to this developer"""
    tickets = get_developer_assigned_tickets(user["id"])
    return {"assigned_tickets": tickets}

@app.get("/developer/tickets/available")
def developer_get_available_tickets(user=Depends(developer_required)):
    """Get unassigned tickets available for self-assignment"""
    tickets = get_available_tickets_for_self_assignment()
    return {"available_tickets": tickets}

@app.post("/developer/tickets/{ticket_id}/self-assign")
def developer_self_assign(ticket_id: int, user=Depends(developer_required)):
    """Developer self-assigns an available ticket"""
    try:
        success = self_assign_ticket(ticket_id, user["id"])
        if success:
            return {"status": "assigned", "message": "Ticket self-assigned successfully"}
        else:
            raise HTTPException(400, "Failed to self-assign ticket")
    except Exception as e:
        raise HTTPException(400, f"Self-assignment failed: {str(e)}")

@app.get("/developer/history")
def developer_get_history(user=Depends(developer_required)):
    """Get developer's personal ticket history"""
    history = get_developer_ticket_history(user["id"])
    return {"ticket_history": history}

@app.post("/developer/tickets/{ticket_id}/complete")
def developer_complete_ticket(ticket_id: int, data: CompleteTicket, user=Depends(developer_required)):
    """Developer completes their assigned ticket"""
    try:
        # Verify ticket is assigned to this developer
        if not verify_ticket_assignment(ticket_id, user["id"]):
            raise HTTPException(403, "You can only complete tickets assigned to you")
        
        success = complete_ticket_by_developer(ticket_id, user["id"], data.completion_notes)
        if success:
            return {"status": "completed", "message": "Ticket completed successfully"}
        else:
            raise HTTPException(400, "Failed to complete ticket")
    except Exception as e:
        raise HTTPException(400, f"Completion failed: {str(e)}")

@app.post("/developer/tickets/{ticket_id}/pass")
def developer_pass_ticket(ticket_id: int, data: PassTicket, user=Depends(developer_required)):
    """Developer passes their assigned ticket back to unassigned"""
    try:
        # Verify ticket is assigned to this developer
        if not verify_ticket_assignment(ticket_id, user["id"]):
            raise HTTPException(403, "You can only pass tickets assigned to you")
        
        success = pass_ticket_by_developer(ticket_id, user["id"], data.reason)
        if success:
            return {"status": "passed", "message": "Ticket passed successfully"}
        else:
            raise HTTPException(400, "Failed to pass ticket")
    except Exception as e:
        raise HTTPException(400, f"Pass failed: {str(e)}")

@app.post("/developer/tickets/{ticket_id}/cancel")
def developer_cancel_ticket(ticket_id: int, data: CancelTicket, user=Depends(developer_required)):
    """Developer cancels their assigned ticket"""
    try:
        # Verify ticket is assigned to this developer
        if not verify_ticket_assignment(ticket_id, user["id"]):
            raise HTTPException(403, "You can only cancel tickets assigned to you")
        
        success = cancel_ticket_by_developer(ticket_id, user["id"], data.reason)
        if success:
            return {"status": "cancelled", "message": "Ticket cancelled successfully"}
        else:
            raise HTTPException(400, "Failed to cancel ticket")
    except Exception as e:
        raise HTTPException(400, f"Cancel failed: {str(e)}")

@app.put("/developer/tickets/{ticket_id}/status")
def developer_update_ticket_status(ticket_id: int, data: UpdateTicketStatus, user=Depends(developer_required)):
    """Developer updates ticket status"""
    try:
        # Verify ticket is assigned to this developer
        if not verify_ticket_assignment(ticket_id, user["id"]):
            raise HTTPException(403, "You can only update tickets assigned to you")
        
        # Validate status
        if data.status not in ['OPEN', 'IN_PROGRESS', 'CLOSED']:
            raise HTTPException(400, "Invalid status. Must be OPEN, IN_PROGRESS, or CLOSED")
        
        success = update_ticket_status_by_developer(ticket_id, user["id"], data.status, data.notes)
        if success:
            return {"status": "updated", "message": "Ticket status updated successfully"}
        else:
            raise HTTPException(400, "Failed to update ticket status")
    except Exception as e:
        raise HTTPException(400, f"Status update failed: {str(e)}")

@app.get("/developer/workload")
def developer_get_workload(user=Depends(developer_required)):
    """Get developer's personal workload statistics"""
    workload = get_developer_workload_stats(user["id"])
    return workload

# ================= CLIENT ENDPOINTS =================
@app.get("/client/dashboard")
def client_dashboard(user=Depends(client_required)):
    """Client dashboard with personal data only"""
    dashboard_data = get_client_dashboard_data(user["id"])
    return dashboard_data

@app.get("/client/tickets/my-tickets")
def client_get_my_tickets(user=Depends(client_required)):
    """Get only tickets created by this client"""
    tickets = get_client_tickets(user["id"])
    return {"my_tickets": tickets}

@app.post("/client/tickets/create")
def client_create_ticket(data: CreateTicket, user=Depends(client_required)):
    """Client creates a new ticket"""
    try:
        ticket_id = create_ticket_by_client(user["id"], data.query, data.priority)
        return {"status": "created", "ticket_id": ticket_id, "message": "Ticket created successfully"}
    except Exception as e:
        raise HTTPException(400, f"Ticket creation failed: {str(e)}")

@app.get("/client/history")
def client_get_history(user=Depends(client_required)):
    """Get client's personal ticket history"""
    history = get_client_ticket_history(user["id"])
    return {"ticket_history": history}

# ================= ACTIVE TICKETS ENDPOINT =================
@app.get("/tickets/active")
def get_active_tickets(user=Depends(get_user)):
    """Get active tickets based on user role for visibility control"""
    try:
        if user["role"] == "client":
            # Clients see only their own tickets
            tickets = get_client_tickets(user["id"])
            return {"tickets": tickets}
        elif user["role"] in ["admin", "project_manager", "developer"]:
            # Staff roles see all active (open and in-progress) tickets
            tickets = get_active_tickets_for_staff()
            return {"tickets": tickets}
        else:
            raise HTTPException(403, "Invalid role for ticket access")
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch active tickets: {str(e)}")

# ================= TICKET DETAILS =================
@app.get("/ticket/{ticket_id}/details")
def get_ticket_details(ticket_id: int, user=Depends(get_user)):
    """Get ticket details with role-based access control"""
    ticket = get_ticket_with_access_control(ticket_id, user["id"], user["role"])
    if not ticket:
        raise HTTPException(404, "Ticket not found or access denied")
    return ticket

# ================= SYSTEM ENDPOINTS =================
@app.get("/system/health")
def system_health():
    """System health check"""
    try:
        conn, cur = get_cursor()
        cur.execute("SELECT 1")
        close_conn(conn, cur)
        
        return {
            "status": "healthy",
            "components": {
                "database": {"status": "healthy", "message": "Database connection successful"},
                "rbac": {"status": "healthy", "message": "Role-based access control active"}
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "components": {
                "database": {"status": "unhealthy", "message": f"Database error: {str(e)}"}
            }
        }

@app.get("/system/stats")
def system_stats(user=Depends(admin_required)):
    """System-wide statistics (admin only)"""
    stats = get_system_statistics()
    return stats

# ================= RUN =================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
