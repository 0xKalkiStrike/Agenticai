"""
AI Chat API Module
Handles AI-powered chat functionality and conversation management
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import json
import os

from database import Database
from ai_engine import AIEngine
from auth import get_current_user

# ================= ROUTER SETUP =================
router = APIRouter(prefix="/ai", tags=["AI Chat"])

# ================= MODELS =================
class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    message_id: str
    conversation_id: str
    response: str
    response_type: str  # 'solution', 'clarification', 'ticket_created', 'escalated'
    confidence: float
    ticket_id: Optional[int] = None
    suggested_actions: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class FeedbackRequest(BaseModel):
    conversation_id: str
    message_id: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    was_helpful: Optional[bool] = None
    comments: Optional[str] = None
    feedback_type: str = Field(default="solution_rating")

class ConversationHistory(BaseModel):
    conversation_id: str
    messages: List[Dict[str, Any]]
    started_at: datetime
    total_messages: int
    is_active: bool

# ================= AI CHAT ENDPOINTS =================

@router.post("/chat", response_model=ChatResponse)
async def send_chat_message(
    message_data: ChatMessage,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a message to the AI assistant and get a response
    """
    try:
        db = Database()
        ai_engine = AIEngine()
        
        user_id = current_user["id"]
        user_role = current_user["role"]
        
        # Generate IDs
        message_id = str(uuid.uuid4())
        conversation_id = message_data.conversation_id or str(uuid.uuid4())
        
        # Get or create conversation
        conversation = await get_or_create_conversation(db, conversation_id, user_id)
        
        # Store user message
        await store_conversation_message(
            db, conversation_id, message_id, "user", 
            message_data.message, message_data.context
        )
        
        # Process query with AI engine
        ai_result = await ai_engine.process_query(
            query=message_data.message,
            user_id=user_id,
            user_role=user_role,
            conversation_id=conversation_id,
            context=message_data.context or {}
        )
        
        # Generate response based on AI result
        response = await generate_ai_response(
            db, ai_engine, ai_result, conversation_id, user_id
        )
        
        # Store AI response message
        ai_message_id = str(uuid.uuid4())
        await store_conversation_message(
            db, conversation_id, ai_message_id, "ai",
            response["response"], {
                "confidence": response["confidence"],
                "response_type": response["response_type"],
                "classification": ai_result.get("classification"),
                "intent": ai_result.get("intent")
            }
        )
        
        # Update conversation metrics
        await update_conversation_metrics(db, conversation_id)
        
        # Log query metrics
        await log_query_metrics(
            db, conversation_id, message_id, user_id,
            message_data.message, ai_result, response
        )
        
        return ChatResponse(
            message_id=ai_message_id,
            conversation_id=conversation_id,
            response=response["response"],
            response_type=response["response_type"],
            confidence=response["confidence"],
            ticket_id=response.get("ticket_id"),
            suggested_actions=response.get("suggested_actions"),
            metadata=response.get("metadata")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")

@router.get("/conversations/{conversation_id}", response_model=ConversationHistory)
async def get_conversation_history(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get conversation history for a specific conversation
    """
    try:
        db = Database()
        
        # Verify conversation belongs to user
        conversation = await get_conversation(db, conversation_id, current_user["id"])
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get messages
        messages = await get_conversation_messages(db, conversation_id)
        
        return ConversationHistory(
            conversation_id=conversation_id,
            messages=messages,
            started_at=conversation["started_at"],
            total_messages=conversation["total_messages"],
            is_active=conversation["is_active"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation: {str(e)}")

@router.get("/conversations")
async def get_user_conversations(
    current_user: dict = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0
):
    """
    Get all conversations for the current user
    """
    try:
        db = Database()
        conversations = await get_user_conversations_list(
            db, current_user["id"], limit, offset
        )
        return {"conversations": conversations}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving conversations: {str(e)}")

@router.post("/feedback")
async def submit_feedback(
    feedback_data: FeedbackRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit feedback for AI responses
    """
    try:
        db = Database()
        
        # Verify conversation belongs to user
        conversation = await get_conversation(db, feedback_data.conversation_id, current_user["id"])
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Store feedback
        feedback_id = await store_feedback(
            db, feedback_data, current_user["id"]
        )
        
        # Process feedback for learning
        await process_feedback_for_learning(db, feedback_data, current_user["id"])
        
        # If feedback indicates solution wasn't helpful, offer ticket creation
        response = {"status": "feedback_received", "feedback_id": feedback_id}
        
        if feedback_data.was_helpful is False or (feedback_data.rating and feedback_data.rating <= 2):
            response["offer_ticket_creation"] = True
            response["message"] = "I'm sorry the solution wasn't helpful. Would you like me to create a support ticket for human assistance?"
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting feedback: {str(e)}")

@router.post("/conversations/{conversation_id}/end")
async def end_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    End an active conversation
    """
    try:
        db = Database()
        
        # Verify conversation belongs to user
        conversation = await get_conversation(db, conversation_id, current_user["id"])
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # End conversation
        await end_conversation_session(db, conversation_id)
        
        return {"status": "conversation_ended", "conversation_id": conversation_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ending conversation: {str(e)}")

# ================= HELPER FUNCTIONS =================

async def get_or_create_conversation(db: Database, conversation_id: str, user_id: int) -> Dict[str, Any]:
    """Get existing conversation or create new one"""
    conn, cursor = db.get_cursor()
    try:
        # Check if conversation exists
        cursor.execute(
            "SELECT * FROM ai_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id)
        )
        conversation = cursor.fetchone()
        
        if not conversation:
            # Create new conversation
            session_id = f"session_{user_id}_{datetime.now().timestamp()}"
            cursor.execute("""
                INSERT INTO ai_conversations (id, user_id, session_id, conversation_context)
                VALUES (%s, %s, %s, %s)
            """, (conversation_id, user_id, session_id, json.dumps({})))
            
            # Fetch the created conversation
            cursor.execute(
                "SELECT * FROM ai_conversations WHERE id = %s",
                (conversation_id,)
            )
            conversation = cursor.fetchone()
        
        return conversation
        
    finally:
        db.close(conn, cursor)

async def get_conversation(db: Database, conversation_id: str, user_id: int) -> Optional[Dict[str, Any]]:
    """Get conversation by ID and user"""
    conn, cursor = db.get_cursor()
    try:
        cursor.execute(
            "SELECT * FROM ai_conversations WHERE id = %s AND user_id = %s",
            (conversation_id, user_id)
        )
        return cursor.fetchone()
    finally:
        db.close(conn, cursor)

async def store_conversation_message(
    db: Database, conversation_id: str, message_id: str, 
    sender_type: str, content: str, metadata: Optional[Dict] = None
):
    """Store a message in the conversation"""
    conn, cursor = db.get_cursor()
    try:
        cursor.execute("""
            INSERT INTO ai_conversation_messages 
            (conversation_id, message_id, sender_type, message_content, message_metadata)
            VALUES (%s, %s, %s, %s, %s)
        """, (conversation_id, message_id, sender_type, content, json.dumps(metadata or {})))
    finally:
        db.close(conn, cursor)

async def get_conversation_messages(db: Database, conversation_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a conversation"""
    conn, cursor = db.get_cursor()
    try:
        cursor.execute("""
            SELECT message_id, sender_type, message_content, message_metadata, timestamp
            FROM ai_conversation_messages
            WHERE conversation_id = %s
            ORDER BY timestamp ASC
        """, (conversation_id,))
        
        messages = cursor.fetchall()
        
        # Parse metadata JSON
        for message in messages:
            if message.get("message_metadata"):
                try:
                    message["message_metadata"] = json.loads(message["message_metadata"])
                except:
                    message["message_metadata"] = {}
        
        return messages
    finally:
        db.close(conn, cursor)

async def get_user_conversations_list(
    db: Database, user_id: int, limit: int, offset: int
) -> List[Dict[str, Any]]:
    """Get list of conversations for a user"""
    conn, cursor = db.get_cursor()
    try:
        cursor.execute("""
            SELECT id, session_id, started_at, ended_at, is_active, 
                   total_messages, resolution_type, satisfaction_rating
            FROM ai_conversations
            WHERE user_id = %s
            ORDER BY started_at DESC
            LIMIT %s OFFSET %s
        """, (user_id, limit, offset))
        
        return cursor.fetchall()
    finally:
        db.close(conn, cursor)

async def update_conversation_metrics(db: Database, conversation_id: str):
    """Update conversation message count and activity"""
    conn, cursor = db.get_cursor()
    try:
        cursor.execute("""
            UPDATE ai_conversations 
            SET total_messages = (
                SELECT COUNT(*) FROM ai_conversation_messages 
                WHERE conversation_id = %s
            )
            WHERE id = %s
        """, (conversation_id, conversation_id))
    finally:
        db.close(conn, cursor)

async def log_query_metrics(
    db: Database, conversation_id: str, message_id: str, user_id: int,
    query: str, ai_result: Dict, response: Dict
):
    """Log query processing metrics"""
    conn, cursor = db.get_cursor()
    try:
        metrics_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO ai_query_metrics 
            (id, conversation_id, message_id, user_id, query_text, 
             classification_result, confidence_score, processing_time_ms, resolution_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            metrics_id, conversation_id, message_id, user_id, query,
            ai_result.get("classification", "unclear"),
            response["confidence"],
            ai_result.get("processing_time_ms", 0),
            response["response_type"]
        ))
    finally:
        db.close(conn, cursor)

async def store_feedback(db: Database, feedback_data: FeedbackRequest, user_id: int) -> str:
    """Store user feedback"""
    conn, cursor = db.get_cursor()
    try:
        feedback_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO ai_feedback 
            (id, conversation_id, message_id, user_id, feedback_type, 
             rating, comments, was_helpful)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            feedback_id, feedback_data.conversation_id, feedback_data.message_id,
            user_id, feedback_data.feedback_type, feedback_data.rating,
            feedback_data.comments, feedback_data.was_helpful
        ))
        return feedback_id
    finally:
        db.close(conn, cursor)

async def process_feedback_for_learning(db: Database, feedback_data: FeedbackRequest, user_id: int):
    """Process feedback to improve AI learning"""
    # This would integrate with the learning system
    # For now, we'll just log it for future processing
    pass

async def end_conversation_session(db: Database, conversation_id: str):
    """End an active conversation"""
    conn, cursor = db.get_cursor()
    try:
        cursor.execute("""
            UPDATE ai_conversations 
            SET is_active = FALSE, ended_at = NOW()
            WHERE id = %s
        """, (conversation_id,))
    finally:
        db.close(conn, cursor)

async def generate_ai_response(
    db: Database, ai_engine: AIEngine, ai_result: Dict, 
    conversation_id: str, user_id: int
) -> Dict[str, Any]:
    """Generate appropriate response based on AI analysis"""
    
    classification = ai_result.get("classification", "unclear")
    confidence = ai_result.get("confidence", 0.0)
    
    if classification == "auto_resolvable" and confidence >= 0.7:
        # AI can handle this query
        solution = ai_result.get("solution", "I'm here to help! Could you provide more details about your question?")
        
        return {
            "response": solution,
            "response_type": "solution",
            "confidence": confidence,
            "suggested_actions": ai_result.get("suggested_actions", []),
            "metadata": {
                "knowledge_base_used": ai_result.get("knowledge_base_used", False),
                "pattern_matched": ai_result.get("pattern_matched", False)
            }
        }
    
    elif classification == "requires_developer" or confidence < 0.7:
        # Create ticket automatically
        ticket_id = await create_automatic_ticket(
            db, user_id, ai_result.get("original_query", ""), 
            ai_result, conversation_id
        )
        
        return {
            "response": f"I understand this requires specialized assistance. I've created support ticket #{ticket_id} for you. Our technical team will review your request and get back to you soon. You can track the progress in your dashboard.",
            "response_type": "ticket_created",
            "confidence": confidence,
            "ticket_id": ticket_id,
            "suggested_actions": [
                "Check your dashboard for ticket updates",
                "You'll receive notifications when there are updates",
                "Feel free to add more details to the ticket if needed"
            ],
            "metadata": {
                "auto_escalated": True,
                "reason": "requires_developer" if classification == "requires_developer" else "low_confidence"
            }
        }
    
    else:
        # Need clarification
        return {
            "response": "I'd like to help you better. Could you provide more specific details about what you're trying to accomplish or what issue you're experiencing?",
            "response_type": "clarification",
            "confidence": confidence,
            "suggested_actions": [
                "Describe the specific problem you're facing",
                "Include any error messages you're seeing",
                "Let me know what you were trying to do when the issue occurred"
            ]
        }

async def create_automatic_ticket(
    db: Database, user_id: int, query: str, 
    ai_result: Dict, conversation_id: str
) -> int:
    """Create a ticket automatically when AI cannot resolve the query"""
    conn, cursor = db.get_cursor()
    try:
        # Determine priority based on AI analysis
        suggested_priority = ai_result.get("suggested_priority", "MEDIUM")
        
        # Create the ticket
        cursor.execute("""
            INSERT INTO tickets (user_id, query, priority)
            VALUES (%s, %s, %s)
        """, (user_id, query, suggested_priority))
        
        ticket_id = cursor.lastrowid
        
        # Create AI metadata for the ticket
        cursor.execute("""
            INSERT INTO ai_ticket_metadata 
            (ticket_id, ai_generated, ai_analysis, original_query, conversation_id, 
             auto_classification, confidence_score, suggested_priority, ai_suggested_category)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            ticket_id, True, ai_result.get("analysis", ""), query, conversation_id,
            ai_result.get("classification", ""), ai_result.get("confidence", 0.0),
            suggested_priority, ai_result.get("category", "general")
        ))
        
        # Update stats
        cursor.execute("UPDATE stats SET total_tickets = total_tickets + 1 WHERE id = 1")
        
        # Create notifications for admins and PMs
        notification_message = f"AI Assistant created ticket #{ticket_id}: {query[:100]}..."
        
        cursor.execute("""
            INSERT INTO notifications (role, message, notification_type, ticket_id)
            VALUES 
            ('admin', %s, 'ai_ticket_created', %s),
            ('project_manager', %s, 'ai_ticket_created', %s)
        """, (notification_message, ticket_id, notification_message, ticket_id))
        
        return ticket_id
        
    finally:
        db.close(conn, cursor)