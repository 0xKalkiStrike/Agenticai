from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import jwt, os
import json
import logging
from decimal import Decimal

from database import *
from database import get_developer_performance_data
from rbac_middleware import (
    get_current_user, 
    role_required, 
    permission_required,
    resource_access_required,
    admin_required,
    admin_or_pm_required,
    developer_required,
    client_required
)
# Temporarily comment out problematic imports
# from audit_service import AuditService
# from ai_engine import AIEngine
# from ticketing_service import TicketingService

# Custom JSON encoder to handle Decimal objects
def convert_decimals(obj):
    """Convert Decimal objects to int/float for JSON serialization"""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    return obj

# ================= APP =================
app = FastAPI(title="Agentic AI Backend")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ✅ FIXED CORS (Docker + Browser safe)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # production ma domain aapo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= SESSION STATE =================
# (In-memory dictionary for demonstration. For production, use Redis, a DB, etc.)
conversation_sessions = {}

# ================= JWT =================
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey")
JWT_ALGO = "HS256"

# ================= AI ENGINE =================
# Try to load the large dataset if it exists, otherwise the small one
# DATASET_PATH = "../../backend/data/knowledge_base_large.json"
# if not os.path.exists(DATASET_PATH):
#     DATASET_PATH = "../../backend/data/knowledge_base.json"

# ai_bot = AIEngine(DATASET_PATH)

# ================= TICKETING SERVICE =================
# ticketing_service = TicketingService()

# ================= MODELS =================
class Login(BaseModel):
    username: str
    password: str

class ChatPayload(BaseModel):
    query: str
    session_id: Optional[str] = None

class Register(BaseModel):
    username: str
    password: str
    email: str

class UserSettings(BaseModel):
    email: str = ""
    emailNotifications: bool = True
    browserNotifications: bool = True
    ticketAssignmentNotifications: bool = True
    ticketUpdateNotifications: bool = True

class CreateUserRequest(BaseModel):
    username: str
    password: str
    email: str
    role: str

class TicketCreateRequest(BaseModel):
    query: str
    priority: str = "MEDIUM"

class TicketCompleteRequest(BaseModel):
    completion_notes: str

class TicketPassRequest(BaseModel):
    reason: str

class TicketCancelRequest(BaseModel):
    reason: str

class TicketStatusUpdateRequest(BaseModel):
    status: str
    notes: str = ""

# ================= HEALTH =================
@app.get("/health")
def health():
    try:
        from database import get_pool_status, get_cursor, close_conn
        
        # Check database connection
        conn, cur = get_cursor()
        cur.execute("SELECT 1 as test")
        result = cur.fetchone()
        close_conn(conn, cur)
        
        # Get pool status
        pool_status = get_pool_status()
        
        return {
            "status": "healthy",
            "database": "connected",
            "pool_status": pool_status,
            "test_query": result
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "database": "disconnected",
            "error": str(e),
            "pool_status": get_pool_status() if 'get_pool_status' in locals() else "unknown"
        }

@app.get("/health/reset-pool")
def reset_pool():
    """Emergency endpoint to reset database connection pool"""
    try:
        from database import reset_connection_pool
        reset_connection_pool()
        return {"status": "pool_reset", "message": "Database connection pool has been reset"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to reset pool: {str(e)}"}

# ================= AUTH =================
@app.post("/login")
def login(data: Login, request: Request):
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        user = authenticate_user(data.username, data.password)
    except Exception as e:
        # Database connection error
        print(f"Database error during login: {e}")
        raise HTTPException(
            status_code=503,
            detail="Service temporarily unavailable. Please try again later."
        )

    if not user:
        try:
            AuditService.log_login_attempt(
                username=data.username,
                user_id=None,
                success=False,
                ip_address=client_ip,
                user_agent=user_agent,
                error_message="Invalid credentials"
            )
        except:
            pass  # Don't fail login if audit logging fails
            
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    try:
        AuditService.log_login_attempt(
            username=data.username,
            user_id=user["id"],
            success=True,
            ip_address=client_ip,
            user_agent=user_agent
        )
    except:
        pass  # Don't fail login if audit logging fails

    token = jwt.encode(
        {
            "id": user["id"],
            "role": user["role"],
            "iat": datetime.utcnow()
        },
        JWT_SECRET,
        algorithm=JWT_ALGO
    )

    return {
        "token": token,
        "role": user["role"],
        "username": data.username
    }

@app.post("/register")
def register(data: Register):
    register_client(data.username, data.password, data.email)
    return {"status": "registered"}

# ================= CLIENT CHAT =================
@app.post("/chat")
@client_required
def chat(data: ChatPayload, current_user=Depends(get_current_user)):
    user_query = data.query
    # Use provided session_id or create a new one
    session_id = data.session_id or str(current_user["id"]) + "_" + str(datetime.now().timestamp())

    session_data = conversation_sessions.get(session_id, {})
    current_state = session_data.get("state")

    # --- Flow Continuation: User is providing more details for a ticket ---
    if current_state == "AWAITING_TECH_DETAILS":
        original_query = session_data.get("original_query", "N/A")
        full_description = f"Original Query: {original_query}\n\nUser Details: {user_query}"
        
        ticket_id = ticketing_service.create_ticket(current_user["id"], full_description, "Medium")
        
        # Clear the session state
        if session_id in conversation_sessions:
            del conversation_sessions[session_id]
        
        # Confirmation to user
        return {
            "reply": f"Thank you. Ticket #{ticket_id} has been created. Our support team will contact you shortly.",
            "source": "human_escalation",
            "status": "ticket_created",
            "ticket_id": ticket_id,
            "session_id": session_id
        }

    # --- Flow Continuation: User is giving feedback on an AI answer ---
    if current_state == "AWAITING_FEEDBACK":
        if "yes" in user_query.lower():
            if session_id in conversation_sessions:
                del conversation_sessions[session_id]
            return {
                "reply": "Great! I'm glad I could help. Let me know if there's anything else.",
                "source": "ai_agent",
                "status": "resolved",
                "session_id": session_id
            }
        else:  # "No" or anything else means it was not helpful, so escalate.
            conversation_sessions[session_id] = {
                "state": "AWAITING_TECH_DETAILS",
                "original_query": session_data.get("original_query")
            }
            return {
                "reply": "I'm sorry I couldn't resolve your issue. Please provide more details, and I will create a ticket for our support team.",
                "source": "ai_agent",
                "status": "gathering_info",
                "session_id": session_id
            }

    # --- ROUTER AGENT (For New Queries) ---
    ai_result = ai_bot.get_response(user_query)

    if ai_result:
        category = ai_result.get("category", "general")
        answer = ai_result["answer"]

        # Path A: Automation for Informational Queries
        if category in ["account", "billing", "general", "chat"]:
            conversation_sessions[session_id] = {
                "state": "AWAITING_FEEDBACK",
                "original_query": user_query
            }
            return {
                "reply": f"{answer}\n\nWas this helpful? (Yes/No)",
                "source": "ai_agent",
                "status": "awaiting_feedback",
                "session_id": session_id
            }
        
        # Path B: Escalation for Technical Queries
        elif category == "technical":
            conversation_sessions[session_id] = { "state": "AWAITING_TECH_DETAILS", "original_query": user_query }
            return {
                "reply": "This seems like a technical issue. To create a ticket, could you please describe the problem in more detail? (e.g., what steps did you take, what error did you see?)",
                "source": "ai_agent",
                "status": "gathering_info",
                "session_id": session_id
            }

    # Path B: Fallback for Unknown Queries
    conversation_sessions[session_id] = { "state": "AWAITING_TECH_DETAILS", "original_query": user_query }
    return {
        "reply": "I'm not sure how to help with that. Please describe your issue in more detail, and I'll create a ticket for our support team.",
        "source": "human_escalation",
        "status": "gathering_info",
        "session_id": session_id
    }

# ================= USERS (ADMIN) =================
@app.get("/admin/users")
@admin_required
def admin_users(current_user=Depends(get_current_user)):
    return list_users()

@app.get("/admin/developer-performance")
@admin_required
def get_developer_performance(period: str = "month", current_user=Depends(get_current_user)):
    """Get developer performance metrics"""
    try:
        performance_data = get_developer_performance_data(period)
        return performance_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance data: {str(e)}")

# ================= TICKETS =================
@app.get("/tickets")
def get_tickets(current_user=Depends(get_current_user)):
    """Get tickets visible to the current user based on their role"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Get tickets based on user role and visibility rules
        tickets = ticket_visibility_engine.get_visible_tickets(
            user_id=current_user["id"],
            user_role=current_user["role"]
        )
        
        return {"tickets": tickets}
    except Exception as e:
        logger.error(f"Error retrieving tickets for user {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve tickets")

@app.get("/tickets/active")
def get_active_tickets(current_user=Depends(get_current_user)):
    """Get active tickets (OPEN and IN_PROGRESS) visible to the current user"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Get active tickets for the Active Tickets section
        tickets = ticket_visibility_engine.get_active_tickets_for_role(
            user_id=current_user["id"],
            user_role=current_user["role"]
        )
        
        return {"tickets": tickets}
    except Exception as e:
        logger.error(f"Error retrieving active tickets for user {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve active tickets")

@app.post("/ticket/{ticket_id}/reply")
@developer_required
@resource_access_required("ticket", "ticket_id")
def reply_ticket(ticket_id: int, data: dict, current_user=Depends(get_current_user)):
    close_ticket(ticket_id, data.get("reply"))
    return {"status": "closed"}

# ================= CLIENT =================
@app.get("/client/tickets")
@client_required
def get_my_tickets(current_user=Depends(get_current_user)):
    """Get tickets for the current client using visibility engine"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Use visibility engine to get client's tickets
        tickets = ticket_visibility_engine.get_visible_tickets(
            user_id=current_user["id"],
            user_role=current_user["role"]
        )
        
        return {"tickets": tickets}
    except Exception as e:
        logger.error(f"Error retrieving client tickets for user {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve tickets")

@app.post("/system/reset-pool")
@admin_required
def reset_pool(current_user=Depends(get_current_user)):
    """Reset database connection pool - admin only"""
    try:
        from database import reset_connection_pool
        reset_connection_pool()
        return {"status": "success", "message": "Connection pool reset"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ================= SYSTEM =================
@app.get("/system/health")
def system_health():
    try:
        from database import get_pool_status
        pool_status = get_pool_status()
        
        conn, cur = get_cursor()
        cur.execute("SELECT 1 as test")
        result = cur.fetchone()
        close_conn(conn, cur)
        
        return {
            "status": "healthy", 
            "database": "ok",
            "pool_status": pool_status,
            "test_query": result
        }
    except Exception as e:
        return {
            "status": "degraded", 
            "error": str(e),
            "pool_status": get_pool_status() if 'get_pool_status' in globals() else "unknown"
        }

# ================= USER SETTINGS =================
@app.get("/user/settings")
def get_user_settings(current_user=Depends(get_current_user)):
    """Get user settings"""
    user_id = current_user["id"]
    
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT email, email_notifications, browser_notifications, 
                   ticket_assignment_notifications, ticket_update_notifications
            FROM user_settings WHERE user_id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        
        if result:
            return {
                "email": result["email"] or "",
                "emailNotifications": bool(result["email_notifications"]),
                "browserNotifications": bool(result["browser_notifications"]),
                "ticketAssignmentNotifications": bool(result["ticket_assignment_notifications"]),
                "ticketUpdateNotifications": bool(result["ticket_update_notifications"])
            }
        else:
            # Return default settings if none exist
            return {
                "email": "",
                "emailNotifications": True,
                "browserNotifications": True,
                "ticketAssignmentNotifications": True,
                "ticketUpdateNotifications": True
            }
    finally:
        close_conn(conn, cur)

# ================= ADMIN ENDPOINTS =================
@app.get("/admin/dashboard")
@admin_required
def admin_dashboard(current_user=Depends(get_current_user)):
    """Admin dashboard with complete system overview"""
    try:
        from dashboard_service import DashboardService
        
        # Get comprehensive dashboard data
        dashboard_data = DashboardService.get_admin_dashboard(current_user["id"])
        
        # Convert to API response format
        response_data = {
            "user_counts": dashboard_data.users_by_role,
            "ticket_stats": {
                "total_tickets": int(dashboard_data.total_tickets),
                "open_tickets": int(dashboard_data.open_tickets),
                "in_progress_tickets": len([t for t in dashboard_data.all_tickets if t.status == "IN_PROGRESS"]),
                "closed_tickets": len([t for t in dashboard_data.all_tickets if t.status == "CLOSED"]),
                "unassigned_tickets": len([t for t in dashboard_data.all_tickets if not t.assigned_developer_id and t.status == "OPEN"])
            },
            "recent_tickets": [
                {
                    "id": ticket.id,
                    "query": ticket.query[:100] + "..." if len(ticket.query) > 100 else ticket.query,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "created_at": ticket.created_at.isoformat(),
                    "client_name": ticket.username,
                    "developer_name": ticket.assigned_developer
                }
                for ticket in dashboard_data.all_tickets[:10]  # Recent 10 tickets
            ]
        }
        
        # Convert Decimal objects to integers/floats
        response_data = convert_decimals(response_data)
        
        return response_data
    except Exception as e:
        print(f"❌ Dashboard service failed: {e}")
        # Fallback to basic database queries if dashboard service fails
        conn, cur = get_cursor()
        try:
            # Get user counts
            cur.execute("""
                SELECT role, COUNT(*) as count
                FROM users
                GROUP BY role
            """)
            role_counts = cur.fetchall()
            user_counts = {role['role']: role['count'] for role in role_counts}
            
            # Get ticket stats
            cur.execute("""
                SELECT 
                    COUNT(*) as total_tickets,
                    SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_tickets,
                    SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_tickets,
                    SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_tickets
                FROM tickets
            """)
            ticket_stats = cur.fetchone()
            
            # Get unassigned tickets
            cur.execute("""
                SELECT COUNT(*) as unassigned_tickets
                FROM tickets t
                LEFT JOIN ticket_assignments ta ON t.id = ta.ticket_id AND ta.is_active = TRUE
                WHERE t.status = 'OPEN' AND ta.id IS NULL
            """)
            unassigned_count = cur.fetchone()
            
            # Get recent tickets
            cur.execute("""
                SELECT t.id, t.query, t.status, t.priority, t.created_at, u.username as client_name,
                       dev.username as developer_name
                FROM tickets t
                JOIN users u ON t.user_id = u.id
                LEFT JOIN ticket_assignments ta ON t.id = ta.ticket_id AND ta.is_active = TRUE
                LEFT JOIN users dev ON ta.developer_id = dev.id
                ORDER BY t.created_at DESC
                LIMIT 10
            """)
            recent_tickets = cur.fetchall()
            
            fallback_data = {
                "user_counts": user_counts,
                "ticket_stats": {
                    "total_tickets": int(ticket_stats['total_tickets'] or 0),
                    "open_tickets": int(ticket_stats['open_tickets'] or 0),
                    "in_progress_tickets": int(ticket_stats['in_progress_tickets'] or 0),
                    "closed_tickets": int(ticket_stats['closed_tickets'] or 0),
                    "unassigned_tickets": int(unassigned_count['unassigned_tickets'] or 0)
                },
                "recent_tickets": [
                    {
                        "id": ticket['id'],
                        "query": ticket['query'][:100] + "..." if len(ticket['query']) > 100 else ticket['query'],
                        "status": ticket['status'],
                        "priority": ticket['priority'],
                        "created_at": ticket['created_at'].isoformat() if ticket['created_at'] else "",
                        "client_name": ticket['client_name'],
                        "developer_name": ticket['developer_name']
                    }
                    for ticket in recent_tickets
                ]
            }
            
            # Convert Decimal objects to integers/floats
            fallback_data = convert_decimals(fallback_data)
            
            return fallback_data
        finally:
            close_conn(conn, cur)

@app.get("/admin/users/all")
@admin_required
def get_all_users(current_user=Depends(get_current_user)):
    """Get all users in the system"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT id, username, email, role, created_at
            FROM users
            ORDER BY created_at DESC
        """)
        users = cur.fetchall()
        return {"users": users}
    finally:
        close_conn(conn, cur)

@app.get("/admin/tickets/all")
@admin_required
def get_all_tickets(current_user=Depends(get_current_user)):
    """Get all tickets in the system for admin"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Admins can see all tickets
        tickets = ticket_visibility_engine.get_visible_tickets(
            user_id=current_user["id"],
            user_role=current_user["role"]
        )
        
        return {"tickets": tickets}
    except Exception as e:
        logger.error(f"Error retrieving all tickets for admin {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve tickets")

@app.get("/admin/developer-performance")
@admin_required
def get_developer_performance(period: str = "month", current_user=Depends(get_current_user)):
    """Get developer performance metrics"""
    try:
        performance_data = get_developer_performance_data(period)
        return performance_data
    except Exception as e:
        return {"error": str(e), "developers": []}

@app.post("/admin/tickets/{ticket_id}/assign")
@admin_required
def assign_ticket_as_admin(ticket_id: int, assignment_data: dict, current_user=Depends(get_current_user)):
    """Admin assigns a ticket to a developer"""
    developer_id = assignment_data.get("developer_id")
    notes = assignment_data.get("notes", "")
    
    if not developer_id:
        raise HTTPException(status_code=400, detail="Developer ID is required")
    
    conn, cur = get_cursor()
    try:
        # Check if ticket exists
        cur.execute("SELECT id, status FROM tickets WHERE id = %s", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Check if developer exists
        cur.execute("SELECT id FROM users WHERE id = %s AND role = 'developer'", (developer_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Developer not found")
        
        # Deactivate any existing assignments
        cur.execute("UPDATE ticket_assignments SET is_active = FALSE WHERE ticket_id = %s", (ticket_id,))
        
        # Create new assignment
        cur.execute("""
            INSERT INTO ticket_assignments (ticket_id, developer_id, assigned_by, assigned_at, is_active, notes)
            VALUES (%s, %s, %s, NOW(), TRUE, %s)
        """, (ticket_id, developer_id, current_user["id"], notes))
        
        # Update ticket status
        cur.execute("UPDATE tickets SET status = 'IN_PROGRESS' WHERE id = %s", (ticket_id,))
        
        return {"status": "success", "message": "Ticket assigned successfully"}
    finally:
        close_conn(conn, cur)

@app.post("/pm/tickets/{ticket_id}/assign")
@role_required("project_manager")
def assign_ticket_as_pm(ticket_id: int, assignment_data: dict, current_user=Depends(get_current_user)):
    """PM assigns a ticket to a developer"""
    developer_id = assignment_data.get("developer_id")
    notes = assignment_data.get("notes", "")
    
    if not developer_id:
        raise HTTPException(status_code=400, detail="Developer ID is required")
    
    conn, cur = get_cursor()
    try:
        # Check if ticket exists
        cur.execute("SELECT id, status FROM tickets WHERE id = %s", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        # Check if developer exists
        cur.execute("SELECT id FROM users WHERE id = %s AND role = 'developer'", (developer_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Developer not found")
        
        # Deactivate any existing assignments
        cur.execute("UPDATE ticket_assignments SET is_active = FALSE WHERE ticket_id = %s", (ticket_id,))
        
        # Create new assignment
        cur.execute("""
            INSERT INTO ticket_assignments (ticket_id, developer_id, assigned_by, assigned_at, is_active, notes)
            VALUES (%s, %s, %s, NOW(), TRUE, %s)
        """, (ticket_id, developer_id, current_user["id"], notes))
        
        # Update ticket status
        cur.execute("UPDATE tickets SET status = 'IN_PROGRESS' WHERE id = %s", (ticket_id,))
        
        return {"status": "success", "message": "Ticket assigned successfully"}
    finally:
        close_conn(conn, cur)

@app.get("/pm/tickets/unassigned")
@role_required("project_manager")
def get_unassigned_tickets_pm(current_user=Depends(get_current_user)):
    """Get unassigned tickets for PM"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Get unassigned tickets for PM assignment
        filters = {
            'status': ['OPEN'],
            'assigned_to': [None]  # Unassigned tickets
        }
        tickets = ticket_visibility_engine.get_visible_tickets(
            user_id=current_user["id"],
            user_role=current_user["role"],
            filters=filters
        )
        
        # Filter out tickets that already have assignments
        unassigned_tickets = [t for t in tickets if not t.get('assigned_developer_id')]
        
        return {"tickets": unassigned_tickets}
    except Exception as e:
        logger.error(f"Error retrieving unassigned tickets for PM {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve unassigned tickets")

# ================= PROJECT MANAGER ENDPOINTS =================
@app.get("/pm/dashboard")
@role_required("project_manager")
def get_pm_dashboard(current_user=Depends(get_current_user)):
    """Get PM dashboard data"""
    try:
        from dashboard_service import DashboardService
        dashboard_data = DashboardService.get_pm_dashboard(current_user["id"])
        
        # Convert to API response format (similar to admin dashboard)
        response_data = {
            "user_counts": dashboard_data.users_by_role,
            "ticket_stats": {
                "total_tickets": int(dashboard_data.total_tickets),
                "open_tickets": int(dashboard_data.open_tickets),
                "in_progress_tickets": len([t for t in dashboard_data.all_tickets if t.status == "IN_PROGRESS"]),
                "closed_tickets": len([t for t in dashboard_data.all_tickets if t.status == "CLOSED"]),
                "unassigned_tickets": len([t for t in dashboard_data.all_tickets if not t.assigned_developer_id and t.status == "OPEN"])
            },
            "recent_tickets": [
                {
                    "id": ticket.id,
                    "query": ticket.query[:100] + "..." if len(ticket.query) > 100 else ticket.query,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "created_at": ticket.created_at.isoformat(),
                    "client_name": ticket.username,
                    "developer_name": ticket.assigned_developer
                }
                for ticket in dashboard_data.all_tickets[:10]
            ]
        }
        
        return convert_decimals(response_data)
    except Exception as e:
        # Fallback to basic queries
        return {"error": str(e)}

@app.get("/pm/team/members")
@role_required("project_manager")
def get_pm_team_members(current_user=Depends(get_current_user)):
    """Get PM team members"""
    conn, cur = get_cursor()
    try:
        # For now, return all users grouped by role (PM sees everyone)
        cur.execute("""
            SELECT id, username, email, role, created_at
            FROM users
            ORDER BY role, username
        """)
        users = cur.fetchall()
        
        # Group by role
        grouped_users = {
            "admin": [],
            "project_manager": [],
            "developer": [],
            "client": []
        }
        
        for user in users:
            role = user['role']
            if role in grouped_users:
                grouped_users[role].append(user)
        
        return grouped_users
    finally:
        close_conn(conn, cur)

@app.post("/pm/team/create-user")
@role_required("project_manager")
def create_team_user(userData: CreateUserRequest, current_user=Depends(get_current_user)):
    """PM creates a team member (developer or client only)"""
    # PM can only create developers and clients
    if userData.role not in ["developer", "client"]:
        raise HTTPException(status_code=403, detail="PM can only create developers and clients")
    
    try:
        # Use the existing registration function
        register_client(userData.username, userData.password, userData.email)
        
        # Update the role if it's not client
        if userData.role == "developer":
            conn, cur = get_cursor()
            try:
                cur.execute("UPDATE users SET role = %s WHERE username = %s", (userData.role, userData.username))
            finally:
                close_conn(conn, cur)
        
        return {"status": "success", "message": f"{userData.role.title()} created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ================= DEVELOPER ENDPOINTS =================
@app.get("/developer/dashboard")
@role_required("developer")
def get_developer_dashboard(current_user=Depends(get_current_user)):
    """Get developer dashboard data"""
    try:
        from dashboard_service import DashboardService
        dashboard_data = DashboardService.get_developer_dashboard(current_user["id"])
        
        # Convert to API response format
        response_data = {
            "assigned_tickets": [
                {
                    "id": ticket.id,
                    "query": ticket.query,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "created_at": ticket.created_at.isoformat(),
                    "client_name": ticket.username
                }
                for ticket in dashboard_data.assigned_tickets
            ],
            "available_tickets": [
                {
                    "id": ticket.id,
                    "query": ticket.query,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "created_at": ticket.created_at.isoformat(),
                    "client_name": ticket.username
                }
                for ticket in dashboard_data.available_tickets
            ],
            "completed_today": dashboard_data.completed_today,
            "workload_stats": {
                "assigned_tickets": dashboard_data.workload_stats.assigned_tickets,
                "completed_today": dashboard_data.workload_stats.completed_today,
                "avg_completion_time": dashboard_data.workload_stats.avg_completion_time,
                "priority_distribution": dashboard_data.workload_stats.priority_distribution
            }
        }
        
        return convert_decimals(response_data)
    except Exception as e:
        return {"error": str(e)}

@app.get("/developer/team/members")
@role_required("developer")
def get_developer_team_members(current_user=Depends(get_current_user)):
    """Get developer team members"""
    conn, cur = get_cursor()
    try:
        # Developers see their team (PM + other developers + clients)
        cur.execute("""
            SELECT id, username, email, role, created_at
            FROM users
            WHERE role IN ('project_manager', 'developer', 'client')
            ORDER BY role, username
        """)
        users = cur.fetchall()
        
        # Group by role
        grouped_users = {
            "project_manager": [],
            "developer": [],
            "client": []
        }
        
        for user in users:
            role = user['role']
            if role in grouped_users:
                grouped_users[role].append(user)
        
        return grouped_users
    finally:
        close_conn(conn, cur)

@app.get("/developer/tickets/my-assigned")
@role_required("developer")
def get_developer_assigned_tickets(current_user=Depends(get_current_user)):
    """Get tickets assigned to the current developer"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Get tickets assigned to this developer
        filters = {
            'assigned_to': [current_user["id"]],
            'status': ['OPEN', 'IN_PROGRESS']
        }
        tickets = ticket_visibility_engine.get_visible_tickets(
            user_id=current_user["id"],
            user_role=current_user["role"],
            filters=filters
        )
        
        return {"assigned_tickets": tickets}
    except Exception as e:
        logger.error(f"Error retrieving assigned tickets for developer {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve assigned tickets")

@app.get("/developer/tickets/available")
@role_required("developer")
def get_available_tickets(current_user=Depends(get_current_user)):
    """Get unassigned tickets available for self-assignment"""
    try:
        from ticket_visibility_engine import ticket_visibility_engine
        
        # Get unassigned tickets that developers can self-assign
        filters = {
            'status': ['OPEN'],
            'assigned_to': [None]  # Unassigned tickets
        }
        tickets = ticket_visibility_engine.get_visible_tickets(
            user_id=current_user["id"],
            user_role=current_user["role"],
            filters=filters
        )
        
        # Filter out tickets that already have assignments
        available_tickets = [t for t in tickets if not t.get('assigned_developer_id')]
        
        return {"available_tickets": available_tickets}
    except Exception as e:
        logger.error(f"Error retrieving available tickets for developer {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve available tickets")

@app.get("/developer/tickets/completed")
@role_required("developer")
def get_developer_completed_tickets(current_user=Depends(get_current_user)):
    """Get completed tickets for the current developer"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username as client_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            JOIN ticket_assignments ta ON t.id = ta.ticket_id
            WHERE ta.developer_id = %s AND ta.is_active = TRUE AND t.status = 'CLOSED'
            ORDER BY t.updated_at DESC
        """, (current_user["id"],))
        
        tickets = cur.fetchall()
        return {"tickets": tickets}
    finally:
        close_conn(conn, cur)

@app.post("/developer/tickets/{ticket_id}/self-assign")
@role_required("developer")
def self_assign_ticket(ticket_id: int, current_user=Depends(get_current_user)):
    """Developer self-assigns a ticket"""
    conn, cur = get_cursor()
    try:
        # Check if ticket exists and is unassigned
        cur.execute("""
            SELECT t.id FROM tickets t
            LEFT JOIN ticket_assignments ta ON t.id = ta.ticket_id AND ta.is_active = TRUE
            WHERE t.id = %s AND t.status = 'OPEN' AND ta.id IS NULL
        """, (ticket_id,))
        
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Ticket not found or already assigned")
        
        # Create assignment
        cur.execute("""
            INSERT INTO ticket_assignments (ticket_id, developer_id, assigned_by, assigned_at, is_active)
            VALUES (%s, %s, %s, NOW(), TRUE)
        """, (ticket_id, current_user["id"], current_user["id"]))
        
        # Update ticket status
        cur.execute("UPDATE tickets SET status = 'IN_PROGRESS' WHERE id = %s", (ticket_id,))
        
        return {"status": "success", "message": "Ticket self-assigned successfully"}
    finally:
        close_conn(conn, cur)

@app.post("/developer/tickets/{ticket_id}/complete")
@role_required("developer")
def complete_ticket(ticket_id: int, completion_data: TicketCompleteRequest, current_user=Depends(get_current_user)):
    """Developer completes a ticket"""
    conn, cur = get_cursor()
    try:
        # Check if ticket is assigned to this developer
        cur.execute("""
            SELECT ta.id FROM ticket_assignments ta
            WHERE ta.ticket_id = %s AND ta.developer_id = %s AND ta.is_active = TRUE
        """, (ticket_id, current_user["id"]))
        
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Ticket not assigned to you")
        
        # Update ticket status and add completion notes
        cur.execute("""
            UPDATE tickets 
            SET status = 'CLOSED', reply = %s, updated_at = NOW()
            WHERE id = %s
        """, (completion_data.completion_notes, ticket_id))
        
        return {"status": "success", "message": "Ticket completed successfully"}
    finally:
        close_conn(conn, cur)

@app.post("/developer/tickets/{ticket_id}/pass")
@role_required("developer")
def pass_ticket(ticket_id: int, pass_data: TicketPassRequest, current_user=Depends(get_current_user)):
    """Developer passes a ticket to another developer"""
    conn, cur = get_cursor()
    try:
        # Check if ticket is assigned to this developer and get developer info
        cur.execute("""
            SELECT ta.id, u.username as developer_name, u.email as developer_email
            FROM ticket_assignments ta
            JOIN users u ON ta.developer_id = u.id
            WHERE ta.ticket_id = %s AND ta.developer_id = %s AND ta.is_active = TRUE
        """, (ticket_id, current_user["id"]))
        
        assignment_info = cur.fetchone()
        if not assignment_info:
            raise HTTPException(status_code=403, detail="Ticket not assigned to you")
        
        # Deactivate current assignment
        cur.execute("""
            UPDATE ticket_assignments 
            SET is_active = FALSE, notes = %s
            WHERE ticket_id = %s AND developer_id = %s AND is_active = TRUE
        """, (f"Passed by developer: {pass_data.reason}", ticket_id, current_user["id"]))
        
        # Update ticket status back to OPEN for reassignment
        cur.execute("UPDATE tickets SET status = 'OPEN' WHERE id = %s", (ticket_id,))
        
        # Add in-app notifications to admins/PMs for reassignment
        cur.execute("""
            INSERT INTO notifications(role, message, type, created_at) 
            VALUES('admin', %s, 'ticket_passed', NOW()), ('project_manager', %s, 'ticket_passed', NOW())
        """, (f"Ticket {ticket_id} passed back by developer: {pass_data.reason}", 
              f"Ticket {ticket_id} passed back by developer: {pass_data.reason}"))
        
        # Get admin and PM emails for email notifications
        cur.execute("""
            SELECT email FROM users 
            WHERE role IN ('admin', 'project_manager') AND email IS NOT NULL AND email != ''
        """)
        admin_emails = [row[0] for row in cur.fetchall()]
        
        # Send email notifications to admins/PMs
        if admin_emails:
            try:
                import sys
                import os
                sys.path.append(os.path.dirname(__file__))
                from email_service import send_ticket_passed_email_to_admins
                send_ticket_passed_email_to_admins(
                    admin_emails, 
                    ticket_id, 
                    assignment_info[1],  # developer_name
                    pass_data.reason
                )
            except Exception as e:
                print(f"Failed to send pass ticket email notifications: {e}")
        
        return {"status": "success", "message": "Ticket passed successfully"}
    finally:
        close_conn(conn, cur)

@app.post("/developer/tickets/{ticket_id}/cancel")
@role_required("developer")
def cancel_ticket(ticket_id: int, cancel_data: TicketCancelRequest, current_user=Depends(get_current_user)):
    """Developer cancels a ticket"""
    conn, cur = get_cursor()
    try:
        # Check if ticket is assigned to this developer and get ticket/user info
        cur.execute("""
            SELECT ta.id, t.user_id, c.username as client_name, c.email as client_email,
                   d.username as developer_name, d.email as developer_email
            FROM ticket_assignments ta
            JOIN tickets t ON ta.ticket_id = t.id
            JOIN users c ON t.user_id = c.id
            JOIN users d ON ta.developer_id = d.id
            WHERE ta.ticket_id = %s AND ta.developer_id = %s AND ta.is_active = TRUE
        """, (ticket_id, current_user["id"]))
        
        ticket_info = cur.fetchone()
        if not ticket_info:
            raise HTTPException(status_code=403, detail="Ticket not assigned to you")
        
        # Update ticket status to CLOSED with cancellation reason
        cur.execute("""
            UPDATE tickets 
            SET status = 'CLOSED', reply = %s, updated_at = NOW()
            WHERE id = %s
        """, (f"Ticket canceled by developer: {cancel_data.reason}", ticket_id))
        
        # Add in-app notification to client with developer's explanation
        cur.execute("""
            INSERT INTO notifications(user_id, message, type, created_at) 
            VALUES(%s, %s, 'ticket_cancelled', NOW())
        """, (ticket_info[1], f"Your ticket {ticket_id} was cancelled: {cancel_data.reason}"))
        
        # Add in-app notifications to admins/PMs
        cur.execute("""
            INSERT INTO notifications(role, message, type, created_at) 
            VALUES('admin', %s, 'ticket_cancelled', NOW()), ('project_manager', %s, 'ticket_cancelled', NOW())
        """, (f"Ticket {ticket_id} cancelled by developer: {cancel_data.reason}", 
              f"Ticket {ticket_id} cancelled by developer: {cancel_data.reason}"))
        
        # Send email notification to client
        if ticket_info[3]:  # client_email
            try:
                import sys
                import os
                sys.path.append(os.path.dirname(__file__))
                from email_service import send_ticket_cancelled_email_to_client
                send_ticket_cancelled_email_to_client(
                    ticket_info[3],  # client_email
                    ticket_info[2],  # client_name
                    ticket_id,
                    ticket_info[4],  # developer_name
                    cancel_data.reason
                )
            except Exception as e:
                print(f"Failed to send cancel ticket email notification to client: {e}")
        
        return {"status": "success", "message": "Ticket canceled successfully"}
    finally:
        close_conn(conn, cur)

@app.put("/developer/tickets/{ticket_id}/status")
@role_required("developer")
def update_ticket_status(ticket_id: int, status_data: TicketStatusUpdateRequest, current_user=Depends(get_current_user)):
    """Developer updates ticket status"""
    conn, cur = get_cursor()
    try:
        # Check if ticket is assigned to this developer
        cur.execute("""
            SELECT ta.id FROM ticket_assignments ta
            WHERE ta.ticket_id = %s AND ta.developer_id = %s AND ta.is_active = TRUE
        """, (ticket_id, current_user["id"]))
        
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Ticket not assigned to you")
        
        # Validate status
        valid_statuses = ['IN_PROGRESS', 'CLOSED']
        if status_data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        # Update ticket status
        if status_data.status == 'CLOSED':
            # If closing, require notes
            if not status_data.notes.strip():
                raise HTTPException(status_code=400, detail="Completion notes are required when closing a ticket")
            
            cur.execute("""
                UPDATE tickets 
                SET status = %s, reply = %s, updated_at = NOW()
                WHERE id = %s
            """, (status_data.status, status_data.notes, ticket_id))
        else:
            # For other status updates
            cur.execute("""
                UPDATE tickets 
                SET status = %s, updated_at = NOW()
                WHERE id = %s
            """, (status_data.status, ticket_id))
        
        return {"status": "success", "message": f"Ticket status updated to {status_data.status}"}
    finally:
        close_conn(conn, cur)

# ================= CLIENT ENDPOINTS =================
@app.get("/client/dashboard")
@role_required("client")
def get_client_dashboard(current_user=Depends(get_current_user)):
    """Get client dashboard data"""
    try:
        from dashboard_service import DashboardService
        dashboard_data = DashboardService.get_client_dashboard(current_user["id"])
        
        # Convert to API response format
        response_data = {
            "total_tickets": dashboard_data.total_tickets,
            "open_tickets": dashboard_data.open_tickets,
            "closed_tickets": dashboard_data.closed_tickets,
            "chat_history": [
                {
                    "id": msg.id,
                    "ticket_id": msg.ticket_id,
                    "message": msg.message,
                    "sender": msg.sender,
                    "timestamp": msg.timestamp.isoformat(),
                    "message_type": msg.message_type
                }
                for msg in dashboard_data.chat_history
            ],
            "recent_tickets": [
                {
                    "id": ticket.id,
                    "query": ticket.query,
                    "status": ticket.status,
                    "priority": ticket.priority,
                    "created_at": ticket.created_at.isoformat(),
                    "assigned_developer": ticket.assigned_developer
                }
                for ticket in dashboard_data.recent_tickets
            ]
        }
        
        return convert_decimals(response_data)
    except Exception as e:
        return {"error": str(e)}

@app.post("/client/tickets/create")
@role_required("client")
def create_client_ticket(ticket_data: TicketCreateRequest, current_user=Depends(get_current_user)):
    """Client creates a new ticket"""
    if not ticket_data.query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    conn, cur = get_cursor()
    try:
        cur.execute("""
            INSERT INTO tickets (user_id, query, priority, status, created_at)
            VALUES (%s, %s, %s, 'OPEN', NOW())
        """, (current_user["id"], ticket_data.query, ticket_data.priority))
        
        ticket_id = cur.lastrowid
        return {"status": "success", "ticket_id": ticket_id, "message": "Ticket created successfully"}
    finally:
        close_conn(conn, cur)

# ================= ADMIN USER MANAGEMENT =================
@app.post("/admin/users/create")
@admin_required
def create_admin_user(userData: CreateUserRequest, current_user=Depends(get_current_user)):
    """Admin creates any type of user"""
    if not all([userData.username, userData.password, userData.email, userData.role]):
        raise HTTPException(status_code=400, detail="All fields are required")
    
    if userData.role not in ["admin", "project_manager", "developer", "client"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    try:
        # Use the existing registration function
        register_client(userData.username, userData.password, userData.email)
        
        # Update the role if it's not client
        if userData.role != "client":
            conn, cur = get_cursor()
            try:
                cur.execute("UPDATE users SET role = %s WHERE username = %s", (userData.role, userData.username))
            finally:
                close_conn(conn, cur)
        
        return {"status": "success", "message": f"{userData.role.title()} created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ================= NOTIFICATIONS =================
@app.get("/notifications")
def get_notifications(current_user=Depends(get_current_user)):
    """Get user notifications"""
    # For now, return empty notifications to prevent 404 errors
    return {"notifications": []}

@app.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user=Depends(get_current_user)):
    """Mark notification as read"""
    return {"status": "success"}

@app.post("/notifications/read-all")
def mark_all_notifications_read(current_user=Depends(get_current_user)):
    """Mark all notifications as read"""
    return {"status": "success"}

@app.delete("/notifications/{notification_id}")
def delete_notification(notification_id: int, current_user=Depends(get_current_user)):
    """Delete notification"""
    return {"status": "success"}

@app.post("/user/settings")
def update_user_settings(settings: UserSettings, current_user=Depends(get_current_user)):
    """Update user settings"""
    user_id = current_user["id"]
    
    conn, cur = get_cursor()
    try:
        # Insert or update user settings
        cur.execute("""
            INSERT INTO user_settings 
            (user_id, email, email_notifications, browser_notifications, 
             ticket_assignment_notifications, ticket_update_notifications)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                email_notifications = VALUES(email_notifications),
                browser_notifications = VALUES(browser_notifications),
                ticket_assignment_notifications = VALUES(ticket_assignment_notifications),
                ticket_update_notifications = VALUES(ticket_update_notifications),
                updated_at = CURRENT_TIMESTAMP
        """, (
            user_id,
            settings.email,
            settings.emailNotifications,
            settings.browserNotifications,
            settings.ticketAssignmentNotifications,
            settings.ticketUpdateNotifications
        ))
        
        return {"success": True, "message": "Settings updated successfully"}
    finally:
        close_conn(conn, cur)

# To fix the NameError, make sure you have REMOVED `from enhanced_main import app`
# from the top of this file.
# This import below will correctly register the routes from your other file.
# Temporarily comment out enhanced_main import
# from enhanced_main import router as knowledge_router
# app.include_router(knowledge_router)

# ================= RUN =================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=False
    )
