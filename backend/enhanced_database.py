import os
from mysql.connector import pooling
from datetime import datetime, timedelta

# ================= CONFIG =================
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "agentic_ai"),
    "autocommit": False  # Changed to False for manual commit control
}

# ================= CONNECTION POOL =================
pool = pooling.MySQLConnectionPool(
    pool_name="agentic_pool",
    pool_size=10,  # Reduced pool size
    pool_reset_session=True,
    **DB_CONFIG
)

def get_cursor():
    conn = pool.get_connection()
    cur = conn.cursor(dictionary=True)
    return conn, cur

def close_conn(conn, cur=None):
    try:
        if cur:
            cur.close()
        if conn:
            conn.close()
    except Exception as e:
        print(f"Error closing connection: {e}")
        pass

# ================= INIT DB =================
def init_db():
    conn, cur = get_cursor()
    try:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE,
            password VARCHAR(255),
            email VARCHAR(100),
            role ENUM('admin','project_manager','developer','client'),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS tickets(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            query TEXT,
            reply TEXT,
            status ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
            priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
            assigned_developer_id INT NULL,
            assigned_by INT NULL,
            assigned_at TIMESTAMP NULL,
            assignment_notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_developer_id) REFERENCES users(id),
            FOREIGN KEY (assigned_by) REFERENCES users(id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS ticket_history(
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            user_id INT,
            query TEXT,
            reply TEXT,
            priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
            assigned_developer_id INT NULL,
            assigned_by INT NULL,
            assigned_at TIMESTAMP NULL,
            assignment_notes TEXT NULL,
            created_at TIMESTAMP,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            developer_username VARCHAR(50),
            client_username VARCHAR(50)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications(
            id INT AUTO_INCREMENT PRIMARY KEY,
            message TEXT,
            role ENUM('admin','project_manager'),
            is_read BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS stats(
            id INT PRIMARY KEY,
            ai INT DEFAULT 0,
            human INT DEFAULT 0
        )
        """)

        cur.execute("SELECT COUNT(*) c FROM stats")
        if cur.fetchone()["c"] == 0:
            cur.execute("INSERT INTO stats VALUES (1,0,0)")
    finally:
        close_conn(conn, cur)

init_db()

# ================= AUTH =================
def authenticate_user(username, password):
    conn, cur = get_cursor()
    try:
        cur.execute(
            "SELECT id, username, role FROM users WHERE username=%s AND password=%s",
            (username, password)
        )
        return cur.fetchone()
    finally:
        close_conn(conn, cur)

def register_client(username, password, email):
    conn, cur = get_cursor()
    try:
        cur.execute(
            "INSERT INTO users(username,password,email,role) VALUES(%s,%s,%s,'client')",
            (username, password, email)
        )
    finally:
        close_conn(conn, cur)

def admin_add_user(username, password, email, role):
    conn, cur = get_cursor()
    try:
        cur.execute(
            "INSERT INTO users(username,password,email,role) VALUES(%s,%s,%s,%s)",
            (username, password, email, role)
        )
    finally:
        close_conn(conn, cur)

def list_users():
    conn, cur = get_cursor()
    try:
        cur.execute("SELECT id,username,email,role FROM users ORDER BY id DESC")
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

# ================= TICKETS =================
def add_ticket(user_id, query, priority):
    conn, cur = get_cursor()
    try:
        cur.execute(
            "INSERT INTO tickets(user_id,query,priority) VALUES(%s,%s,%s)",
            (user_id, query, priority)
        )
        cur.execute("UPDATE stats SET human = human + 1 WHERE id=1")

        msg = f"New ticket: {query[:80]}"
        cur.execute(
            "INSERT INTO notifications(message,role) VALUES(%s,'admin'),(%s,'project_manager')",
            (msg, msg)
        )
        
        # Return the ticket ID
        return cur.lastrowid
    finally:
        close_conn(conn, cur)

def list_open_tickets():
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username, dev.username as assigned_developer
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            LEFT JOIN users dev ON dev.id=t.assigned_developer_id
            WHERE t.status='OPEN'
            ORDER BY t.created_at DESC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def list_all_tickets():
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username, dev.username as assigned_developer
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            LEFT JOIN users dev ON dev.id=t.assigned_developer_id
            ORDER BY t.created_at DESC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def close_ticket(ticket_id, reply):
    conn, cur = get_cursor()
    try:
        cur.execute(
            """UPDATE tickets SET reply=%s,status='CLOSED',updated_at=NOW() WHERE id=%s""",
            (reply, ticket_id)
        )
        cur.execute("UPDATE stats SET ai = ai + 1 WHERE id=1")
        conn.commit()  # Add missing commit
        
        # Move to ticket history
        move_ticket_to_history(ticket_id)
    finally:
        close_conn(conn, cur)

def move_ticket_to_history(ticket_id):
    """Copy closed ticket to ticket_history table"""
    conn, cur = get_cursor()
    try:
        # Get ticket details with usernames
        cur.execute("""
            SELECT t.id, t.user_id, t.query, t.reply, t.priority, t.assigned_developer_id,
                   t.assigned_by, t.assigned_at, t.assignment_notes, t.created_at,
                   u.username as client_username, dev.username as developer_username
            FROM tickets t
            LEFT JOIN users u ON u.id = t.user_id
            LEFT JOIN users dev ON dev.id = t.assigned_developer_id
            WHERE t.id = %s
        """, (ticket_id,))
        
        ticket = cur.fetchone()
        if not ticket:
            return
        
        # Insert into ticket_history
        cur.execute("""
            INSERT INTO ticket_history 
            (ticket_id, user_id, query, reply, priority, assigned_developer_id, 
             assigned_by, assigned_at, assignment_notes, created_at, developer_username, client_username)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            ticket.get('id') if isinstance(ticket, dict) else ticket[0],
            ticket.get('user_id') if isinstance(ticket, dict) else ticket[1],
            ticket.get('query') if isinstance(ticket, dict) else ticket[2],
            ticket.get('reply') if isinstance(ticket, dict) else ticket[3],
            ticket.get('priority') if isinstance(ticket, dict) else ticket[4],
            ticket.get('assigned_developer_id') if isinstance(ticket, dict) else ticket[5],
            ticket.get('assigned_by') if isinstance(ticket, dict) else ticket[6],
            ticket.get('assigned_at') if isinstance(ticket, dict) else ticket[7],
            ticket.get('assignment_notes') if isinstance(ticket, dict) else ticket[8],
            ticket.get('created_at') if isinstance(ticket, dict) else ticket[9],
            ticket.get('developer_username') if isinstance(ticket, dict) else ticket[11],
            ticket.get('client_username') if isinstance(ticket, dict) else ticket[10]
        ))
        
        conn.commit()
    except Exception as e:
        print(f"Error moving ticket to history: {e}")
    finally:
        close_conn(conn, cur)
def get_ticket_by_id(ticket_id):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username, u.email, 
                   dev.username as assigned_developer,
                   assigner.username as assigned_by_username
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            LEFT JOIN users dev ON dev.id=t.assigned_developer_id
            LEFT JOIN users assigner ON assigner.id=t.assigned_by
            WHERE t.id=%s
        """, (ticket_id,))
        return cur.fetchone()
    finally:
        close_conn(conn, cur)

# ================= ENHANCED DEVELOPER FUNCTIONS =================
def get_developer_assigned_tickets(developer_id):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username, u.email,
                   assigner.username as assigned_by_username,
                   assigner.role as assigned_by_role
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            LEFT JOIN users assigner ON assigner.id = t.assigned_by
            WHERE t.assigned_developer_id=%s AND t.status='OPEN'
            ORDER BY t.priority DESC, t.created_at ASC
        """, (developer_id,))
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_available_tickets_for_assignment():
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username as client_username, u.email as client_email
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            WHERE t.assigned_developer_id IS NULL AND t.status='OPEN'
            ORDER BY t.priority DESC, t.created_at ASC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_developer_completed_today(developer_id):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT COUNT(*) as count
            FROM tickets
            WHERE assigned_developer_id=%s 
            AND status='CLOSED' 
            AND DATE(updated_at) = CURDATE()
        """, (developer_id,))
        result = cur.fetchone()
        return result["count"] if result else 0
    finally:
        close_conn(conn, cur)

def get_developer_completed_week(developer_id):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT COUNT(*) as count
            FROM tickets
            WHERE assigned_developer_id=%s 
            AND status='CLOSED' 
            AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """, (developer_id,))
        result = cur.fetchone()
        return result["count"] if result else 0
    finally:
        close_conn(conn, cur)

def get_developer_all_tickets(developer_id):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username, u.email,
                   CASE WHEN t.status='CLOSED' THEN t.updated_at ELSE NULL END as completed_at
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            WHERE t.assigned_developer_id=%s
            ORDER BY t.created_at DESC
        """, (developer_id,))
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def assign_ticket_to_developer(ticket_id, developer_id, assigned_by, notes=""):
    conn, cur = get_cursor()
    try:
        # Check if ticket exists and is open
        cur.execute("SELECT status FROM tickets WHERE id=%s", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket or ticket["status"] != "OPEN":
            return False
        
        # Check if developer exists
        cur.execute("SELECT id FROM users WHERE id=%s AND role='developer'", (developer_id,))
        if not cur.fetchone():
            return False
        
        # Assign the ticket
        cur.execute("""
            UPDATE tickets 
            SET assigned_developer_id=%s, assigned_by=%s, assigned_at=NOW(), assignment_notes=%s
            WHERE id=%s
        """, (developer_id, assigned_by, notes, ticket_id))
        
        conn.commit()  # Add missing commit
        return cur.rowcount > 0
    except Exception as e:
        print(f"Error assigning ticket: {e}")
        conn.rollback()
        return False
    finally:
        close_conn(conn, cur)

# ================= ANALYTICS =================
def get_stats():
    conn, cur = get_cursor()
    try:
        cur.execute("SELECT ai,human FROM stats WHERE id=1")
        return cur.fetchone()
    finally:
        close_conn(conn, cur)

# ================= NOTIFICATIONS =================
def get_notifications(role):
    conn, cur = get_cursor()
    try:
        cur.execute(
            "SELECT * FROM notifications WHERE role=%s AND is_read=0",
            (role,)
        )
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def mark_notification_read(notification_id):
    conn, cur = get_cursor()
    try:
        cur.execute("UPDATE notifications SET is_read=1 WHERE id=%s", (notification_id,))
    finally:
        close_conn(conn, cur)
