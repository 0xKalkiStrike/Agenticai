import os
from mysql.connector import pooling

# ================= CONFIG =================
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "agentic_ai"),
    "autocommit": True
}

# ================= CONNECTION POOL =================
pool = pooling.MySQLConnectionPool(
    pool_name="agentic_pool",
    pool_size=20,
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
        conn.close()
    except:
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            "SELECT id, role FROM users WHERE username=%s AND password=%s",
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
    finally:
        close_conn(conn, cur)

def list_open_tickets():
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.*, u.username
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
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
            SELECT t.*, u.username
            FROM tickets t
            LEFT JOIN users u ON u.id=t.user_id
            ORDER BY t.created_at DESC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def close_ticket(ticket_id, reply):
    conn, cur = get_cursor()
    try:
        cur.execute(
            "UPDATE tickets SET reply=%s,status='CLOSED' WHERE id=%s",
            (reply, ticket_id)
        )
        cur.execute("UPDATE stats SET ai = ai + 1 WHERE id=1")
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

# ================= DEVELOPER PERFORMANCE =================
def get_developer_performance_data(period="month"):
    """Get developer performance metrics for the specified period"""
    conn, cur = get_cursor()
    try:
        # Calculate date filter based on period
        date_filter = ""
        if period == "week":
            date_filter = "AND ta.assigned_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)"
        elif period == "month":
            date_filter = "AND ta.assigned_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)"
        # For "all", no date filter is applied
        
        # Get developers and their ticket completion stats using ticket_assignments table
        cur.execute(f"""
            SELECT 
                u.id,
                u.username,
                COUNT(ta.id) as total_tickets,
                SUM(CASE WHEN t.status = 'CLOSED' THEN 1 ELSE 0 END) as completed_tickets,
                SUM(CASE WHEN t.status = 'OPEN' AND ta.is_active = 1 THEN 1 ELSE 0 END) as in_progress_tickets,
                AVG(CASE WHEN t.status = 'CLOSED' AND ta.assigned_at IS NOT NULL THEN 
                    TIMESTAMPDIFF(HOUR, ta.assigned_at, t.updated_at) 
                    ELSE NULL END) as avg_completion_time
            FROM users u
            LEFT JOIN ticket_assignments ta ON u.id = ta.developer_id AND ta.is_active = 1 {date_filter}
            LEFT JOIN tickets t ON ta.ticket_id = t.id
            WHERE u.role = 'developer'
            GROUP BY u.id, u.username
            ORDER BY completed_tickets DESC
        """)
        
        developers = cur.fetchall()
        
        # Calculate performance metrics
        performance_data = []
        for dev in developers:
            total_tickets = dev['total_tickets'] or 0
            completed_tickets = dev['completed_tickets'] or 0
            in_progress_tickets = dev['in_progress_tickets'] or 0
            
            completion_rate = 0
            if total_tickets > 0:
                completion_rate = (completed_tickets / total_tickets) * 100
            
            performance_data.append({
                'developer_id': dev['id'],
                'developer_name': dev['username'],
                'total_tickets': total_tickets,
                'completed_tickets': completed_tickets,
                'in_progress_tickets': in_progress_tickets,
                'completion_rate': round(completion_rate, 2),
                'avg_completion_time': round(dev['avg_completion_time'] or 0, 2)
            })
        
        return {
            'period': period,
            'developers': performance_data
        }
    finally:
        close_conn(conn, cur)

# ================= POOL STATUS =================
def get_pool_status():
    """Get connection pool status"""
    try:
        return {
            "status": "active",
            "pool_size": pool.pool_size,
            "pool_name": pool.pool_name
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

def reset_connection_pool():
    """Reset the connection pool"""
    global pool
    try:
        # Close existing pool
        pool._remove_connections()
        
        # Create new pool
        pool = pooling.MySQLConnectionPool(
            pool_name="agentic_pool",
            pool_size=20,
            **DB_CONFIG
        )
        return True
    except Exception as e:
        print(f"Error resetting pool: {e}")
        return False