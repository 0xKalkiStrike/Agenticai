"""
Database Module
Handles all MySQL database operations
"""

import os
import json
from typing import Optional, List, Dict, Any
from mysql.connector import pooling, Error

class Database:
    """Database connection and operations handler"""
    
    def __init__(self):
        self.config = {
            "host": os.getenv("DB_HOST", "localhost"),
            "user": os.getenv("DB_USER", "root"),
            "password": os.getenv("DB_PASSWORD", ""),
            "database": os.getenv("DB_NAME", "agentic_ai"),
            "autocommit": True
        }
        self.pool = None
        self._init_pool()
    
    def _init_pool(self):
        """Initialize connection pool"""
        try:
            self.pool = pooling.MySQLConnectionPool(
                pool_name="support_pool",
                pool_size=10,
                **self.config
            )
        except Error as e:
            print(f"Database connection error: {e}")
            raise
    
    def get_cursor(self):
        """Get database cursor from pool"""
        conn = self.pool.get_connection()
        cursor = conn.cursor(dictionary=True)
        return conn, cursor
    
    def close(self, conn, cursor=None):
        """Close connection and cursor"""
        try:
            if cursor:
                cursor.close()
            conn.close()
        except:
            pass
    
    def execute(self, query: str, params: tuple = None) -> Any:
        """Execute a single query"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(query, params)
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    # ================= AUTH =================
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """Authenticate user credentials"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "SELECT id, username, email, role FROM users WHERE username = %s AND password = %s",
                (username, password)
            )
            return cursor.fetchone()
        finally:
            self.close(conn, cursor)
    
    def register_client(self, username: str, password: str, email: str):
        """Register a new client"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "INSERT INTO users (username, password, email, role) VALUES (%s, %s, %s, 'client')",
                (username, password, email)
            )
        finally:
            self.close(conn, cursor)
    
    def add_user(self, username: str, password: str, email: str, role: str):
        """Add a new user (admin function)"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "INSERT INTO users (username, password, email, role) VALUES (%s, %s, %s, %s)",
                (username, password, email, role)
            )
        finally:
            self.close(conn, cursor)
    
    def get_all_users(self) -> List[Dict]:
        """Get all users"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute("SELECT id, username, email, role, created_at FROM users ORDER BY id DESC")
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    def delete_user(self, user_id: int):
        """Delete a user"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
        finally:
            self.close(conn, cursor)
    
    def get_developers(self) -> List[Dict]:
        """Get all developers"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "SELECT id, username, email FROM users WHERE role = 'developer'"
            )
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    # ================= TICKETS =================
    def create_ticket(self, user_id: int, query: str, priority: str = "MEDIUM") -> int:
        """Create a new ticket"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "INSERT INTO tickets (user_id, query, priority) VALUES (%s, %s, %s)",
                (user_id, query, priority)
            )
            ticket_id = cursor.lastrowid
            
            # Update stats if table exists
            try:
                cursor.execute("UPDATE stats SET total_tickets = total_tickets + 1 WHERE id = 1")
            except:
                pass
            
            # Create notification if table exists
            try:
                cursor.execute(
                    "INSERT INTO notifications (role, message, notification_type, ticket_id) VALUES ('admin', %s, 'ticket_created', %s), ('project_manager', %s, 'ticket_created', %s)",
                    (f"New ticket #{ticket_id}: {query[:80]}...", ticket_id, f"New ticket #{ticket_id}: {query[:80]}...", ticket_id)
                )
            except:
                pass
            
            return ticket_id
        finally:
            self.close(conn, cursor)
    
    def get_ticket(self, ticket_id: int) -> Optional[Dict]:
        """Get ticket by ID"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                """SELECT t.*, u.username 
                   FROM tickets t 
                   LEFT JOIN users u ON t.user_id = u.id 
                   WHERE t.id = %s""",
                (ticket_id,)
            )
            return cursor.fetchone()
        finally:
            self.close(conn, cursor)
    
    def get_user_tickets(self, user_id: int) -> List[Dict]:
        """Get tickets for a specific user"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "SELECT * FROM tickets WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    def get_open_tickets(self) -> List[Dict]:
        """Get all open tickets"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                """SELECT t.*, u.username 
                   FROM tickets t 
                   LEFT JOIN users u ON t.user_id = u.id 
                   WHERE t.status != 'CLOSED' 
                   ORDER BY t.created_at DESC"""
            )
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    def get_all_tickets(self) -> List[Dict]:
        """Get all tickets"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                """SELECT t.*, u.username 
                   FROM tickets t 
                   LEFT JOIN users u ON t.user_id = u.id 
                   ORDER BY t.created_at DESC"""
            )
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    def get_developer_tickets(self, developer_id: int) -> List[Dict]:
        """Get tickets assigned to a developer"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                """SELECT t.*, u.username 
                   FROM tickets t 
                   LEFT JOIN users u ON t.user_id = u.id 
                   WHERE t.assigned_to = %s 
                   ORDER BY t.created_at DESC""",
                (developer_id,)
            )
            return cursor.fetchall()
        finally:
            self.close(conn, cursor)
    
    def close_ticket(self, ticket_id: int, reply: str):
        """Close a ticket with reply"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "UPDATE tickets SET reply = %s, status = 'CLOSED' WHERE id = %s",
                (reply, ticket_id)
            )
            try:
                cursor.execute("UPDATE stats SET human_resolved = human_resolved + 1 WHERE id = 1")
            except:
                pass
        finally:
            self.close(conn, cursor)
    
    def assign_ticket(self, ticket_id: int, developer_id: int, assigned_by: int, notes: str = ""):
        """Assign ticket to developer"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "UPDATE tickets SET assigned_to = %s, status = 'IN_PROGRESS' WHERE id = %s",
                (developer_id, ticket_id)
            )
            try:
                cursor.execute(
                    "INSERT INTO ticket_assignments (ticket_id, developer_id, assigned_by, notes) VALUES (%s, %s, %s, %s)",
                    (ticket_id, developer_id, assigned_by, notes)
                )
            except:
                pass
        finally:
            self.close(conn, cursor)
    
    def update_ticket_priority(self, ticket_id: int, priority: str):
        """Update ticket priority"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "UPDATE tickets SET priority = %s WHERE id = %s",
                (priority, ticket_id)
            )
        finally:
            self.close(conn, cursor)
    
    def add_ticket_message(self, ticket_id: int, user_id: int, message: str, user_role: str):
        """Add message to ticket"""
        conn, cursor = self.get_cursor()
        try:
            try:
                message_type = "client" if user_role == "client" else "developer"
                cursor.execute(
                    "INSERT INTO ticket_messages (ticket_id, user_id, message, message_type) VALUES (%s, %s, %s, %s)",
                    (ticket_id, user_id, message, message_type)
                )
            except:
                pass
            
            # Update ticket reply field for backward compatibility
            prefix = "[CLIENT] " if user_role == "client" else ""
            cursor.execute(
                "UPDATE tickets SET reply = CONCAT(IFNULL(reply, ''), '\\n---\\n', %s) WHERE id = %s",
                (prefix + message, ticket_id)
            )
        finally:
            self.close(conn, cursor)
    
    # ================= STATS =================
    def get_stats(self) -> Dict:
        """Get system statistics"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute("SELECT ai_resolved as ai, human_resolved as human FROM stats WHERE id = 1")
            result = cursor.fetchone()
            return result or {"ai": 0, "human": 0}
        except:
            return {"ai": 0, "human": 0}
        finally:
            self.close(conn, cursor)
    
    # ================= NOTIFICATIONS =================
    def get_notifications(self, role: str, user_id: int) -> List[Dict]:
        """Get notifications for user"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                """SELECT * FROM notifications 
                   WHERE (role = %s OR user_id = %s) AND is_read = FALSE 
                   ORDER BY created_at DESC LIMIT 50""",
                (role, user_id)
            )
            return cursor.fetchall()
        except:
            return []
        finally:
            self.close(conn, cursor)
    
    def mark_notification_read(self, notification_id: int):
        """Mark notification as read"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute("UPDATE notifications SET is_read = TRUE WHERE id = %s", (notification_id,))
        except:
            pass
        finally:
            self.close(conn, cursor)
    
    def mark_all_notifications_read(self, role: str, user_id: int):
        """Mark all notifications as read"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "UPDATE notifications SET is_read = TRUE WHERE role = %s OR user_id = %s",
                (role, user_id)
            )
        except:
            pass
        finally:
            self.close(conn, cursor)
    
    # ================= KNOWLEDGE BASE =================
    def get_knowledge_base(self) -> List[Dict]:
        """Get all knowledge base entries"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute("SELECT * FROM knowledge_base WHERE is_active = TRUE ORDER BY id DESC")
            entries = cursor.fetchall()
            # Parse JSON keywords
            for entry in entries:
                if entry.get("keywords"):
                    try:
                        entry["keywords"] = json.loads(entry["keywords"])
                    except:
                        pass
            return entries
        except:
            return []
        finally:
            self.close(conn, cursor)
    
    def add_knowledge_entry(self, keywords: List[str], answer: str, category: str) -> int:
        """Add knowledge base entry"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "INSERT INTO knowledge_base (keywords, answer, category) VALUES (%s, %s, %s)",
                (json.dumps(keywords), answer, category)
            )
            return cursor.lastrowid
        except:
            return 0
        finally:
            self.close(conn, cursor)
    
    def delete_knowledge_entry(self, entry_id: int):
        """Delete knowledge base entry"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute("UPDATE knowledge_base SET is_active = FALSE WHERE id = %s", (entry_id,))
        except:
            pass
        finally:
            self.close(conn, cursor)
    
    # ================= USER SETTINGS =================
    def get_user_settings(self, user_id: int) -> Dict:
        """Get user settings"""
        conn, cursor = self.get_cursor()
        try:
            cursor.execute(
                "SELECT * FROM user_settings WHERE user_id = %s",
                (user_id,)
            )
            settings = cursor.fetchone()
            
            if settings:
                return {
                    "email": settings.get("email", ""),
                    "emailNotifications": bool(settings.get("email_notifications", True)),
                    "browserNotifications": bool(settings.get("browser_notifications", True)),
                    "ticketAssignmentNotifications": bool(settings.get("ticket_assignment_notifications", True)),
                    "ticketUpdateNotifications": bool(settings.get("ticket_update_notifications", True))
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
        except:
            # Return default settings if table doesn't exist
            return {
                "email": "",
                "emailNotifications": True,
                "browserNotifications": True,
                "ticketAssignmentNotifications": True,
                "ticketUpdateNotifications": True
            }
        finally:
            self.close(conn, cursor)
    
    def update_user_settings(self, user_id: int, settings: Dict):
        """Update user settings"""
        conn, cursor = self.get_cursor()
        try:
            # Try to update existing settings
            cursor.execute("""
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
                settings.get("email", ""),
                settings.get("emailNotifications", True),
                settings.get("browserNotifications", True),
                settings.get("ticketAssignmentNotifications", True),
                settings.get("ticketUpdateNotifications", True)
            ))
        except:
            # If table doesn't exist, just pass - settings will be handled by frontend localStorage
            pass
        finally:
            self.close(conn, cursor)