"""
AI Support Ticket System - FastAPI Backend
Main application entry point
"""

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import jwt
import os

# Import modules
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from database import Database
from ai_engine import AIEngine
from auth import AuthService
from ai_chat_api import router as ai_chat_router

# ================= APP SETUP =================
app = FastAPI(
    title="AI Support Ticket System API",
    description="Backend API for AI-powered IT Support Management",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= CONFIGURATION =================
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60

# Initialize services
db = Database()
ai_engine = AIEngine()
auth_service = AuthService(JWT_SECRET, JWT_ALGORITHM)

# Set global auth service for dependency injection
import auth
auth.auth_service = auth_service

# Include AI chat router
app.include_router(ai_chat_router)

# Session storage for conversations
conversation_sessions = {}

# ================= MODELS =================
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "client"

class ChatRequest(BaseModel):
    query: str
    priority: Optional[str] = "MEDIUM"
    session_id: Optional[str] = None

class TicketReplyRequest(BaseModel):
    reply: str

class TicketAssignRequest(BaseModel):
    developer_id: int
    notes: Optional[str] = ""

class TicketPriorityRequest(BaseModel):
    priority: str

class AddUserRequest(BaseModel):
    username: str
    password: str
    email: str
    role: str

class KnowledgeEntryRequest(BaseModel):
    keywords: List[str]
    answer: str
    category: str

class TicketMessageRequest(BaseModel):
    message: str

class UserSettingsRequest(BaseModel):
    email: Optional[str] = ""
    emailNotifications: bool = True
    browserNotifications: bool = True
    ticketAssignmentNotifications: bool = True
    ticketUpdateNotifications: bool = True

# ================= AUTH DEPENDENCY =================
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*roles):
    """Require specific roles for access"""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# ================= HEALTH ENDPOINTS =================
@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/system/health")
def system_health():
    try:
        db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}

# ================= AUTH ENDPOINTS =================
@app.post("/login")
def login(data: LoginRequest, request: Request):
    user = db.authenticate_user(data.username, data.password)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT token
    payload = {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {"token": token, "role": user["role"]}

@app.post("/admin/create-user")
def create_user_admin(data: RegisterRequest, current_user: dict = Depends(require_role("admin"))):
    """Admin endpoint to create users with any role"""
    try:
        db.add_user(data.username, data.password, data.email, data.role)
        return {"status": "created", "message": f"User {data.username} created successfully with role {data.role}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/register")
def register(data: RegisterRequest):
    try:
        if data.role == "client":
            db.register_client(data.username, data.password, data.email)
        else:
            db.add_user(data.username, data.password, data.email, data.role)
        return {"status": "registered", "message": "Account created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ================= CLIENT ENDPOINTS =================
@app.post("/chat")
def chat(data: ChatRequest, current_user: dict = Depends(require_role("client"))):
    user_id = current_user["id"]
    query = data.query
    session_id = data.session_id or f"{user_id}_{datetime.now().timestamp()}"
    
    # Get or create session
    session = conversation_sessions.get(session_id, {})
    current_state = session.get("state")
    
    # Handle conversation flow states
    if current_state == "AWAITING_TECH_DETAILS":
        # Create ticket with details
        original_query = session.get("original_query", query)
        full_description = f"{original_query}\n\nAdditional Details: {query}"
        
        ticket_id = db.create_ticket(user_id, full_description, data.priority)
        conversation_sessions.pop(session_id, None)
        
        # Notify all users about new ticket
        notify_all_users_about_ticket(ticket_id, full_description, current_user["username"])
        
        return {
            "reply": f"✅ Support ticket #{ticket_id} has been created successfully! Our technical team has been notified and will review your issue shortly. You can track progress in your dashboard.",
            "ticket_created": True,
            "ticket_id": ticket_id,
            "session_id": session_id
        }
    
    if current_state == "AWAITING_SATISFACTION_BASIC":
        # User responded to basic knowledge base solution
        if "yes" in query.lower() or "satisfied" in query.lower() or "solved" in query.lower():
            conversation_sessions.pop(session_id, None)
            return {
                "reply": "🎉 Great! I'm glad I could help you. Feel free to ask if you need anything else!",
                "session_id": session_id
            }
        else:
            # User not satisfied - try DeepSeek AI
            original_query = session.get("original_query", "")
            ai_answer, confidence = ask_ai_deepseek(original_query)
            
            conversation_sessions[session_id] = {
                "state": "AWAITING_SATISFACTION_AI",
                "original_query": original_query,
                "ai_answer": ai_answer
            }
            
            return {
                "reply": f"🤖 Let me provide a more detailed solution:\n\n{ai_answer}\n\nDoes this help resolve your issue? (Yes/No)",
                "ai_enhanced": True,
                "session_id": session_id
            }
    
    if current_state == "AWAITING_SATISFACTION_AI":
        # User responded to DeepSeek AI solution
        if "yes" in query.lower() or "satisfied" in query.lower() or "solved" in query.lower():
            conversation_sessions.pop(session_id, None)
            return {
                "reply": "🎉 Excellent! I'm happy the advanced solution worked for you. Don't hesitate to reach out if you need more help!",
                "session_id": session_id
            }
        else:
            # User still not satisfied - create ticket
            original_query = session.get("original_query", query)
            ticket_id = db.create_ticket(user_id, f"{original_query}\n\nUser tried both basic and AI solutions but still needs help.", data.priority)
            conversation_sessions.pop(session_id, None)
            
            # Notify all users about escalated ticket
            notify_all_users_about_ticket(ticket_id, original_query, current_user["username"], escalated=True)
            
            return {
                "reply": f"🎫 I understand this needs specialized attention. I've created priority support ticket #{ticket_id} for you. Our expert team has been notified and will provide personalized assistance shortly.",
                "ticket_created": True,
                "ticket_id": ticket_id,
                "escalated": True,
                "session_id": session_id
            }
    
    # NEW QUERY - Start the 50:50 process
    # Step 1: Try knowledge base first (basic solution)
    context = retrieve_context(query)
    
    if context:
        # Found basic solution in knowledge base
        conversation_sessions[session_id] = {
            "state": "AWAITING_SATISFACTION_BASIC",
            "original_query": query,
            "basic_answer": context
        }
        
        return {
            "reply": f"💡 Here's a quick solution:\n\n{context}\n\nDid this solve your problem? (Yes/No)",
            "basic_solution": True,
            "session_id": session_id
        }
    else:
        # No basic solution found - try DeepSeek AI directly
        ai_answer, confidence = ask_ai_deepseek(query)
        
        if confidence > 0.6:
            conversation_sessions[session_id] = {
                "state": "AWAITING_SATISFACTION_AI",
                "original_query": query,
                "ai_answer": ai_answer
            }
            
            return {
                "reply": f"🤖 Let me help you with that:\n\n{ai_answer}\n\nDoes this resolve your issue? (Yes/No)",
                "ai_response": True,
                "session_id": session_id
            }
        else:
            # Low confidence - offer ticket creation immediately
            conversation_sessions[session_id] = {
                "state": "AWAITING_TECH_DETAILS",
                "original_query": query
            }
            
            return {
                "reply": "🤔 This seems like a complex issue that would benefit from human expertise. Could you please provide more details about the problem so I can create a detailed support ticket for our technical team?",
                "session_id": session_id
            }

def notify_all_users_about_ticket(ticket_id: int, description: str, client_username: str, escalated: bool = False):
    """
    Notify all relevant users when a ticket is created
    """
    try:
        # Prepare notification message
        ticket_type = "🔥 ESCALATED" if escalated else "🎫 NEW"
        short_desc = description[:100] + "..." if len(description) > 100 else description
        
        notification_message = f"{ticket_type} TICKET #{ticket_id}: {short_desc} (by {client_username})"
        
        # Notify admins and project managers
        db.create_notification("admin", notification_message, "ticket_created", ticket_id)
        db.create_notification("project_manager", notification_message, "ticket_created", ticket_id)
        
        # If escalated, also notify developers
        if escalated:
            db.create_notification("developer", f"🔥 ESCALATED TICKET #{ticket_id}: Client needs expert help - {short_desc}", "ticket_escalated", ticket_id)
        
        print(f"✅ All users notified about ticket #{ticket_id}")
        
    except Exception as e:
        print(f"❌ Error notifying users about ticket {ticket_id}: {e}")

# Add the missing imports and functions
from ai_engine import ask_ai_deepseek, retrieve_context

@app.get("/client/tickets")
def get_client_tickets(current_user: dict = Depends(require_role("client"))):
    tickets = db.get_user_tickets(current_user["id"])
    return {"tickets": tickets}

@app.get("/client/tickets/{ticket_id}")
def get_client_ticket_details(ticket_id: int, current_user: dict = Depends(require_role("client"))):
    ticket = db.get_ticket(ticket_id)
    if not ticket or ticket["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@app.post("/ticket/{ticket_id}/chat")
def send_ticket_message(ticket_id: int, data: TicketMessageRequest, current_user: dict = Depends(get_current_user)):
    ticket = db.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Append message to ticket
    db.add_ticket_message(ticket_id, current_user["id"], data.message, current_user["role"])
    return {"status": "sent"}

# ================= TICKET ENDPOINTS =================
@app.get("/tickets")
def get_open_tickets(current_user: dict = Depends(require_role("admin", "project_manager", "developer"))):
    return db.get_open_tickets()

@app.get("/ticket/{ticket_id}")
def get_ticket(ticket_id: int, current_user: dict = Depends(get_current_user)):
    ticket = db.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@app.post("/ticket/{ticket_id}/reply")
def reply_ticket(ticket_id: int, data: TicketReplyRequest, current_user: dict = Depends(require_role("developer", "admin"))):
    db.close_ticket(ticket_id, data.reply)
    return {"status": "closed"}

@app.post("/ticket/{ticket_id}/assign")
def assign_ticket(ticket_id: int, data: TicketAssignRequest, current_user: dict = Depends(require_role("admin", "project_manager"))):
    db.assign_ticket(ticket_id, data.developer_id, current_user["id"], data.notes)
    return {"status": "assigned"}

@app.put("/ticket/{ticket_id}/priority")
def update_ticket_priority(ticket_id: int, data: TicketPriorityRequest, current_user: dict = Depends(require_role("admin", "project_manager"))):
    db.update_ticket_priority(ticket_id, data.priority)
    return {"status": "updated"}

# ================= ADMIN ENDPOINTS =================
@app.get("/admin/users")
def get_all_users(current_user: dict = Depends(require_role("admin"))):
    return db.get_all_users()

@app.post("/admin/add-user")
def add_user(data: AddUserRequest, current_user: dict = Depends(require_role("admin"))):
    try:
        db.add_user(data.username, data.password, data.email, data.role)
        return {"status": "created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/admin/users/{user_id}")
def delete_user(user_id: int, current_user: dict = Depends(require_role("admin"))):
    db.delete_user(user_id)
    return {"status": "deleted"}

@app.get("/admin/tickets")
def get_all_tickets(current_user: dict = Depends(require_role("admin"))):
    return db.get_all_tickets()

# ================= DEVELOPER ENDPOINTS =================
@app.get("/developer/tickets")
def get_developer_tickets(current_user: dict = Depends(require_role("developer"))):
    return db.get_developer_tickets(current_user["id"])

@app.get("/developers")
def get_developers(current_user: dict = Depends(require_role("admin", "project_manager"))):
    return db.get_developers()

# ================= ANALYTICS ENDPOINTS =================
@app.get("/analytics")
def get_analytics(current_user: dict = Depends(require_role("admin", "project_manager"))):
    return db.get_stats()

# ================= NOTIFICATION ENDPOINTS =================
@app.get("/notifications")
def get_notifications(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role")
    user_id = current_user.get("id")
    return db.get_notifications(role, user_id)

@app.post("/notification/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user: dict = Depends(get_current_user)):
    db.mark_notification_read(notification_id)
    return {"status": "read"}

@app.post("/notifications/read-all")
def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    db.mark_all_notifications_read(current_user["role"], current_user["id"])
    return {"status": "all_read"}

# ================= KNOWLEDGE BASE ENDPOINTS =================
@app.get("/admin/knowledge")
def get_knowledge_base(current_user: dict = Depends(require_role("admin"))):
    return db.get_knowledge_base()

@app.post("/admin/knowledge")
def add_knowledge_entry(data: KnowledgeEntryRequest, current_user: dict = Depends(require_role("admin"))):
    entry_id = db.add_knowledge_entry(data.keywords, data.answer, data.category)
    return {"status": "created", "id": entry_id}

@app.delete("/admin/knowledge/{entry_id}")
def delete_knowledge_entry(entry_id: int, current_user: dict = Depends(require_role("admin"))):
    db.delete_knowledge_entry(entry_id)
    return {"status": "deleted"}

# ================= ADMIN DASHBOARD ENDPOINTS =================
@app.get("/admin/dashboard")
def get_admin_dashboard(current_user: dict = Depends(require_role("admin"))):
    """Get admin dashboard data"""
    try:
        # Get basic statistics
        conn, cursor = db.get_cursor()
        
        # Get user counts by role
        cursor.execute("""
            SELECT role, COUNT(*) as count
            FROM users
            GROUP BY role
        """)
        role_counts = cursor.fetchall()
        user_counts = {role['role']: role['count'] for role in role_counts}
        
        # Get ticket statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_tickets,
                SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_tickets,
                SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_tickets,
                SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_tickets
            FROM tickets
        """)
        ticket_stats = cursor.fetchone()
        
        # Get recent tickets
        cursor.execute("""
            SELECT t.id, t.query, t.status, t.priority, t.created_at, u.username as client_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 10
        """)
        recent_tickets = cursor.fetchall()
        
        db.close(conn, cursor)
        
        return {
            "user_counts": user_counts,
            "ticket_stats": {
                "total_tickets": int(ticket_stats['total_tickets'] or 0),
                "open_tickets": int(ticket_stats['open_tickets'] or 0),
                "in_progress_tickets": int(ticket_stats['in_progress_tickets'] or 0),
                "closed_tickets": int(ticket_stats['closed_tickets'] or 0)
            },
            "recent_tickets": [
                {
                    "id": ticket['id'],
                    "query": ticket['query'][:100] + "..." if len(ticket['query']) > 100 else ticket['query'],
                    "status": ticket['status'],
                    "priority": ticket['priority'],
                    "created_at": ticket['created_at'].isoformat() if ticket['created_at'] else "",
                    "client_name": ticket['client_name']
                }
                for ticket in recent_tickets
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard error: {str(e)}")

@app.get("/admin/users/all")
def get_all_users_admin(current_user: dict = Depends(require_role("admin"))):
    """Get all users for admin"""
    try:
        users = db.get_all_users()
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting users: {str(e)}")

@app.get("/admin/tickets/all")
def get_all_tickets_admin(current_user: dict = Depends(require_role("admin"))):
    """Get all tickets for admin"""
    try:
        tickets = db.get_all_tickets()
        return {"tickets": tickets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting tickets: {str(e)}")

@app.post("/admin/users/create")
def create_user_admin(user_data: AddUserRequest, current_user: dict = Depends(require_role("admin"))):
    """Create a new user (admin only)"""
    try:
        db.add_user(user_data.username, user_data.password, user_data.email, user_data.role)
        return {"status": "success", "message": f"User {user_data.username} created successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error creating user: {str(e)}")

@app.delete("/admin/users/{user_id}")
def delete_user_admin(user_id: int, current_user: dict = Depends(require_role("admin"))):
    """Delete a user (admin only)"""
    try:
        db.delete_user(user_id)
        return {"status": "success", "message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error deleting user: {str(e)}")

# ================= DEVELOPER ENDPOINTS =================
@app.get("/developers")
def get_developers_list(current_user: dict = Depends(require_role("admin", "project_manager"))):
    """Get list of developers"""
    try:
        developers = db.get_developers()
        return {"developers": developers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting developers: {str(e)}")

# ================= ANALYTICS ENDPOINTS =================
@app.get("/analytics")
def get_analytics_data(current_user: dict = Depends(require_role("admin", "project_manager"))):
    """Get analytics data"""
    try:
        stats = db.get_stats()
        return {"analytics": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting analytics: {str(e)}")

# ================= NOTIFICATIONS ENDPOINTS =================
@app.get("/notifications")
def get_user_notifications(current_user: dict = Depends(get_current_user)):
    """Get notifications for current user"""
    try:
        notifications = db.get_notifications(current_user["role"], current_user["id"])
        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting notifications: {str(e)}")

@app.post("/notifications/{notification_id}/read")
def mark_notification_as_read(notification_id: int, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    try:
        db.mark_notification_read(notification_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking notification: {str(e)}")

@app.post("/notifications/read-all")
def mark_all_notifications_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    try:
        db.mark_all_notifications_read(current_user["role"], current_user["id"])
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking notifications: {str(e)}")

# ================= USER SETTINGS ENDPOINTS =================
@app.get("/user/settings")
def get_user_settings(current_user: dict = Depends(get_current_user)):
    """Get user settings"""
    try:
        settings = db.get_user_settings(current_user["id"])
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting user settings: {str(e)}")

@app.post("/user/settings")
def update_user_settings(settings_data: UserSettingsRequest, current_user: dict = Depends(get_current_user)):
    """Update user settings"""
    try:
        db.update_user_settings(current_user["id"], settings_data.dict())
        return {"status": "success", "message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating user settings: {str(e)}")

# ================= RUN =================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
