import os
from mysql.connector import pooling
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# ================= CONFIG =================
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),  # WAMP default is empty password
    "database": os.getenv("DB_NAME", "agentic_ai"),
    "port": int(os.getenv("DB_PORT", "3306")),  # MySQL default port (Apache runs on 8080)
    "autocommit": True
}

# ================= CONNECTION POOL =================
pool = pooling.MySQLConnectionPool(
    pool_name="rbac_pool",
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
def init_enhanced_db():
    conn, cur = get_cursor()
    try:
        # Enhanced users table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            email VARCHAR(100),
            role ENUM('admin','project_manager','developer','client') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP NULL,
            team_lead_id INT NULL,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (team_lead_id) REFERENCES users(id)
        )
        """)

        # PM Team Management table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS pm_teams(
            id INT AUTO_INCREMENT PRIMARY KEY,
            pm_id INT NOT NULL,
            member_id INT NOT NULL,
            member_role ENUM('developer','client') NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE KEY unique_pm_member (pm_id, member_id),
            FOREIGN KEY (pm_id) REFERENCES users(id),
            FOREIGN KEY (member_id) REFERENCES users(id)
        )
        """)

        # Enhanced tickets table with full assignment tracking
        cur.execute("""
        CREATE TABLE IF NOT EXISTS tickets(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            query TEXT NOT NULL,
            reply TEXT NULL,
            status ENUM('OPEN','IN_PROGRESS','CLOSED') DEFAULT 'OPEN',
            priority ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
            assigned_developer_id INT NULL,
            assigned_by INT NULL,
            assigned_at TIMESTAMP NULL,
            assignment_notes TEXT NULL,
            completed_at TIMESTAMP NULL,
            completion_notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_developer_id) REFERENCES users(id),
            FOREIGN KEY (assigned_by) REFERENCES users(id)
        )
        """)

        # Ticket assignment history
        cur.execute("""
        CREATE TABLE IF NOT EXISTS ticket_assignment_history(
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            developer_id INT NOT NULL,
            assigned_by INT NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            unassigned_at TIMESTAMP NULL,
            assignment_notes TEXT NULL,
            is_self_assigned BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (ticket_id) REFERENCES tickets(id),
            FOREIGN KEY (developer_id) REFERENCES users(id),
            FOREIGN KEY (assigned_by) REFERENCES users(id)
        )
        """)

        # User activity log
        cur.execute("""
        CREATE TABLE IF NOT EXISTS user_activity_log(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            details TEXT NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)

        # Notifications table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            role ENUM('admin','project_manager','developer','client') NULL,
            message TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'info',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)

        # System stats
        cur.execute("""
        CREATE TABLE IF NOT EXISTS system_stats(
            id INT PRIMARY KEY,
            total_tickets INT DEFAULT 0,
            completed_tickets INT DEFAULT 0,
            active_users INT DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """)

        # Initialize system stats
        cur.execute("INSERT IGNORE INTO system_stats (id) VALUES (1)")
        
        # Chat history table for AI conversations
        cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            confidence FLOAT DEFAULT 0.0,
            ticket_created BOOLEAN DEFAULT FALSE,
            ticket_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id)
        )
        """)
        
        # --- Add Indexes for Performance ---
        print("✅ Adding indexes for performance...")
        cur.execute("""
            SELECT COUNT(1) as count_exists
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
            AND table_name = 'users'
            AND index_name = 'idx_users_role'
        """)
        result = cur.fetchone()
        exists = result['count_exists'] if result else 0

        if not exists:
            cur.execute("CREATE INDEX idx_users_role ON users(role)")

        cur.execute("""
            SELECT COUNT(1) as count_exists
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
            AND table_name = 'tickets'
            AND index_name = 'idx_tickets_status'
        """)
        result = cur.fetchone()
        exists = result['count_exists'] if result else 0

        if not exists:
            cur.execute("CREATE INDEX idx_tickets_status ON tickets(status)")
        
        cur.execute("""
            SELECT COUNT(1) as count_exists
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
            AND table_name = 'tickets'
            AND index_name = 'idx_tickets_priority'
        """)
        result = cur.fetchone()
        exists = result['count_exists'] if result else 0

        if not exists:
            cur.execute("CREATE INDEX idx_tickets_priority ON tickets(priority)")
        
        print("✅ Enhanced RBAC database schema initialized")
        
    finally:
        close_conn(conn, cur)

# Initialize on import
init_enhanced_db()

# ================= DEVELOPER PERFORMANCE =================
def get_developer_performance_data(period="month"):
    """Get developer performance metrics for the specified period"""
    conn, cur = get_cursor()
    try:
        # Calculate date filter based on period
        date_filter = ""
        if period == "week":
            date_filter = "AND t.assigned_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)"
        elif period == "month":
            date_filter = "AND t.assigned_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)"
        # For "all", no date filter is applied
        
        # Get developers and their ticket completion stats using assigned_developer_id column
        cur.execute(f"""
            SELECT 
                u.id,
                u.username,
                COUNT(t.id) as total_tickets,
                SUM(CASE WHEN t.status = 'CLOSED' THEN 1 ELSE 0 END) as completed_tickets,
                SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_tickets,
                AVG(CASE WHEN t.status = 'CLOSED' AND t.assigned_at IS NOT NULL THEN 
                    TIMESTAMPDIFF(HOUR, t.assigned_at, t.completed_at) 
                    ELSE NULL END) as avg_completion_time
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_developer_id {date_filter}
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

# ================= AUTH FUNCTIONS =================
def authenticate_user(username: str, password: str) -> Optional[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT id, username, role, email, is_active 
            FROM users 
            WHERE username=%s AND password=%s AND is_active=TRUE
        """, (username, password))
        
        user = cur.fetchone()
        if user:
            # Update last login
            cur.execute(
                "UPDATE users SET last_login=NOW() WHERE id=%s", 
                (user["id"],)
            )
            
            # Log login activity
            log_user_activity(user["id"], "LOGIN", f"User {username} logged in")
        
        return user
    finally:
        close_conn(conn, cur)

def register_client(username: str, password: str, email: str) -> int:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            INSERT INTO users(username, password, email, role) 
            VALUES(%s, %s, %s, 'client')
        """, (username, password, email))
        
        user_id = cur.lastrowid
        log_user_activity(user_id, "REGISTER", f"Client {username} registered")
        return user_id
    finally:
        close_conn(conn, cur)

def create_user_by_admin(username: str, password: str, email: str, role: str, admin_id: int) -> int:
    conn, cur = get_cursor()
    try:
        if role not in ['admin', 'project_manager', 'developer', 'client']:
            raise ValueError("Invalid role")
        
        cur.execute("""
            INSERT INTO users(username, password, email, role, created_by) 
            VALUES(%s, %s, %s, %s, %s)
        """, (username, password, email, role, admin_id))
        
        user_id = cur.lastrowid
        log_user_activity(admin_id, "CREATE_USER", f"Created {role} user: {username}")
        return user_id
    finally:
        close_conn(conn, cur)

# ================= ADMIN FUNCTIONS =================
def get_admin_dashboard_data() -> Dict:
    conn, cur = get_cursor()
    try:
        # Get user counts by role
        cur.execute("""
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE is_active=TRUE 
            GROUP BY role
        """)
        user_counts = {row["role"]: row["count"] for row in cur.fetchall()}
        
        # Get ticket statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_tickets,
                SUM(CASE WHEN status='OPEN' THEN 1 ELSE 0 END) as open_tickets,
                SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_tickets,
                SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) as closed_tickets,
                SUM(CASE WHEN assigned_developer_id IS NULL THEN 1 ELSE 0 END) as unassigned_tickets
            FROM tickets
        """)
        ticket_stats = cur.fetchone()
        
        # Get recent activity
        cur.execute("""
            SELECT t.id, t.query, t.status, t.priority, t.created_at,
                   c.username as client_name,
                   d.username as developer_name
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            LEFT JOIN users d ON t.assigned_developer_id = d.id
            ORDER BY t.created_at DESC
            LIMIT 10
        """)
        recent_tickets = cur.fetchall()
        
        return {
            "user_counts": user_counts,
            "ticket_stats": ticket_stats,
            "recent_tickets": recent_tickets
        }
    finally:
        close_conn(conn, cur)

def get_users_by_role() -> Dict:
    conn, cur = get_cursor()
    try:
        result = {}
        
        for role in ['admin', 'project_manager', 'developer', 'client']:
            cur.execute("""
                SELECT id, username, email, created_at, last_login, is_active
                FROM users 
                WHERE role=%s AND is_active=TRUE
                ORDER BY username
            """, (role,))
            result[role] = cur.fetchall()
        
        return result
    finally:
        close_conn(conn, cur)

def get_developers_with_workload() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT u.id, u.username, u.email, u.created_at,
                   COUNT(t.id) as assigned_tickets,
                   SUM(CASE WHEN t.status='CLOSED' AND DATE(t.completed_at) = CURDATE() THEN 1 ELSE 0 END) as completed_today,
                   SUM(CASE WHEN t.status='CLOSED' AND t.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as completed_this_week
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_developer_id
            WHERE u.role='developer' AND u.is_active=TRUE
            GROUP BY u.id, u.username, u.email, u.created_at
            ORDER BY u.username
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_clients_with_ticket_counts() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT u.id, u.username, u.email, u.created_at,
                   COUNT(t.id) as total_tickets,
                   SUM(CASE WHEN t.status='OPEN' THEN 1 ELSE 0 END) as open_tickets,
                   SUM(CASE WHEN t.status='CLOSED' THEN 1 ELSE 0 END) as closed_tickets
            FROM users u
            LEFT JOIN tickets t ON u.id = t.user_id
            WHERE u.role='client' AND u.is_active=TRUE
            GROUP BY u.id, u.username, u.email, u.created_at
            ORDER BY u.username
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_project_managers() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT u.id, u.username, u.email, u.created_at, u.last_login,
                   COUNT(t.id) as tickets_assigned
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_by
            WHERE u.role='project_manager' AND u.is_active=TRUE
            GROUP BY u.id, u.username, u.email, u.created_at, u.last_login
            ORDER BY u.username
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_all_tickets_with_assignments() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.reply, t.status, t.priority, 
                   t.created_at, t.assigned_at, t.completed_at,
                   c.username as client_name, c.email as client_email,
                   d.username as developer_name, d.email as developer_email,
                   a.username as assigned_by_name,
                   t.assignment_notes, t.completion_notes
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            LEFT JOIN users d ON t.assigned_developer_id = d.id
            LEFT JOIN users a ON t.assigned_by = a.id
            ORDER BY t.created_at DESC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

# ================= PROJECT MANAGER FUNCTIONS =================
def get_pm_dashboard_data() -> Dict:
    conn, cur = get_cursor()
    try:
        # Get unassigned tickets
        cur.execute("""
            SELECT COUNT(*) as unassigned_tickets
            FROM tickets 
            WHERE assigned_developer_id IS NULL AND status='OPEN'
        """)
        unassigned_count = cur.fetchone()["unassigned_tickets"]
        
        # Get developer workload
        cur.execute("""
            SELECT u.id, u.username,
                   COUNT(t.id) as assigned_tickets
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_developer_id AND t.status IN ('OPEN', 'IN_PROGRESS')
            WHERE u.role='developer' AND u.is_active=TRUE
            GROUP BY u.id, u.username
            ORDER BY assigned_tickets ASC
        """)
        developer_workload = cur.fetchall()
        
        return {
            "unassigned_tickets": unassigned_count,
            "developer_workload": developer_workload
        }
    finally:
        close_conn(conn, cur)

def get_available_developers() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT u.id, u.username, u.email,
                   COUNT(t.id) as current_workload
            FROM users u
            LEFT JOIN tickets t ON u.id = t.assigned_developer_id AND t.status IN ('OPEN', 'IN_PROGRESS')
            WHERE u.role='developer' AND u.is_active=TRUE
            GROUP BY u.id, u.username, u.email
            ORDER BY current_workload ASC, u.username
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_unassigned_tickets() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.priority, t.created_at,
                   c.username as client_name, c.email as client_email
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            WHERE t.assigned_developer_id IS NULL AND t.status='OPEN'
            ORDER BY t.priority DESC, t.created_at ASC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

# ================= DEVELOPER FUNCTIONS =================
def get_developer_dashboard_data(developer_id: int) -> Dict:
    conn, cur = get_cursor()
    try:
        # Get assigned tickets count
        cur.execute("""
            SELECT COUNT(*) as assigned_tickets
            FROM tickets 
            WHERE assigned_developer_id=%s AND status IN ('OPEN', 'IN_PROGRESS')
        """, (developer_id,))
        assigned_count = cur.fetchone()["assigned_tickets"]
        
        # Get completed today
        cur.execute("""
            SELECT COUNT(*) as completed_today
            FROM tickets 
            WHERE assigned_developer_id=%s AND status='CLOSED' 
            AND DATE(completed_at) = CURDATE()
        """, (developer_id,))
        completed_today = cur.fetchone()["completed_today"]
        
        # Get available tickets
        cur.execute("""
            SELECT COUNT(*) as available_tickets
            FROM tickets 
            WHERE assigned_developer_id IS NULL AND status='OPEN'
        """)
        available_count = cur.fetchone()["available_tickets"]
        
        return {
            "assigned_tickets": assigned_count,
            "completed_today": completed_today,
            "available_tickets": available_count
        }
    finally:
        close_conn(conn, cur)

def get_developer_assigned_tickets(developer_id: int) -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.status, t.priority, t.created_at, t.assigned_at,
                   c.username as client_name, c.email as client_email,
                   t.assignment_notes
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            WHERE t.assigned_developer_id=%s AND t.status IN ('OPEN', 'IN_PROGRESS')
            ORDER BY t.priority DESC, t.assigned_at ASC
        """, (developer_id,))
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_available_tickets_for_self_assignment() -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.priority, t.created_at,
                   c.username as client_name, c.email as client_email
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            WHERE t.assigned_developer_id IS NULL AND t.status='OPEN'
            ORDER BY t.priority DESC, t.created_at ASC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_developer_ticket_history(developer_id: int) -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.reply, t.status, t.priority, 
                   t.created_at, t.assigned_at, t.completed_at,
                   c.username as client_name,
                   t.completion_notes
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            WHERE t.assigned_developer_id=%s
            ORDER BY t.completed_at DESC, t.assigned_at DESC
        """, (developer_id,))
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_developer_workload_stats(developer_id: int) -> Dict:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT 
                COUNT(CASE WHEN status IN ('OPEN', 'IN_PROGRESS') THEN 1 END) as active_tickets,
                COUNT(CASE WHEN status='CLOSED' AND DATE(completed_at) = CURDATE() THEN 1 END) as completed_today,
                COUNT(CASE WHEN status='CLOSED' AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as completed_this_week,
                COUNT(CASE WHEN status='CLOSED' THEN 1 END) as total_completed
            FROM tickets 
            WHERE assigned_developer_id=%s
        """, (developer_id,))
        
        stats = cur.fetchone()
        
        # Calculate workload score (simple algorithm)
        workload_score = stats["active_tickets"] * 1.0 + max(0, 10 - stats["completed_today"]) * 0.1
        
        return {
            "active_tickets": stats["active_tickets"],
            "completed_today": stats["completed_today"],
            "completed_this_week": stats["completed_this_week"],
            "total_completed": stats["total_completed"],
            "workload_score": round(workload_score, 1)
        }
    finally:
        close_conn(conn, cur)

# ================= CLIENT FUNCTIONS =================
def get_client_dashboard_data(client_id: int) -> Dict:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN status='OPEN' THEN 1 END) as open_tickets,
                COUNT(CASE WHEN status='IN_PROGRESS' THEN 1 END) as in_progress_tickets,
                COUNT(CASE WHEN status='CLOSED' THEN 1 END) as closed_tickets
            FROM tickets 
            WHERE user_id=%s
        """, (client_id,))
        
        return cur.fetchone()
    finally:
        close_conn(conn, cur)

def get_client_tickets(client_id: int) -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.reply, t.status, t.priority, 
                   t.created_at, t.assigned_at, t.completed_at,
                   d.username as developer_name
            FROM tickets t
            LEFT JOIN users d ON t.assigned_developer_id = d.id
            WHERE t.user_id=%s
            ORDER BY t.created_at DESC
        """, (client_id,))
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def get_client_ticket_history(client_id: int) -> List[Dict]:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT t.id, t.query, t.reply, t.status, t.priority, 
                   t.created_at, t.completed_at,
                   d.username as developer_name,
                   CASE WHEN t.status='CLOSED' THEN 'Resolved' ELSE 'Pending' END as resolution_status
            FROM tickets t
            LEFT JOIN users d ON t.assigned_developer_id = d.id
            WHERE t.user_id=%s
            ORDER BY t.created_at DESC
        """, (client_id,))
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def create_ticket_by_client(client_id: int, query: str, priority: str) -> int:
    conn, cur = get_cursor()
    try:
        if priority not in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
            priority = 'MEDIUM'
        
        cur.execute("""
            INSERT INTO tickets(user_id, query, priority) 
            VALUES(%s, %s, %s)
        """, (client_id, query, priority))
        
        ticket_id = cur.lastrowid
        
        # Create notification for admins and PMs
        cur.execute("""
            INSERT INTO notifications(role, message, type) 
            VALUES('admin', %s, 'new_ticket'), ('project_manager', %s, 'new_ticket')
        """, (f"New {priority} priority ticket created: {query[:50]}...", 
              f"New {priority} priority ticket created: {query[:50]}..."))
        
        log_user_activity(client_id, "CREATE_TICKET", f"Created ticket: {query[:50]}...")
        
        return ticket_id
    finally:
        close_conn(conn, cur)

# ================= TICKET MANAGEMENT =================
def assign_ticket_to_developer(ticket_id: int, developer_id: int, assigned_by: int, notes: str = "") -> bool:
    conn, cur = get_cursor()
    try:
        # Verify ticket exists and is open
        cur.execute("SELECT status FROM tickets WHERE id=%s", (ticket_id,))
        ticket = cur.fetchone()
        if not ticket or ticket["status"] not in ['OPEN']:
            return False
        
        # Verify developer exists
        cur.execute("SELECT id FROM users WHERE id=%s AND role='developer' AND is_active=TRUE", (developer_id,))
        if not cur.fetchone():
            return False
        
        # Assign ticket
        cur.execute("""
            UPDATE tickets 
            SET assigned_developer_id=%s, assigned_by=%s, assigned_at=NOW(), 
                assignment_notes=%s, status='IN_PROGRESS'
            WHERE id=%s
        """, (developer_id, assigned_by, notes, ticket_id))
        
        # Record in assignment history
        cur.execute("""
            INSERT INTO ticket_assignment_history(ticket_id, developer_id, assigned_by, assignment_notes)
            VALUES(%s, %s, %s, %s)
        """, (ticket_id, developer_id, assigned_by, notes))
        
        # Send enhanced notifications
        notify_ticket_assigned(ticket_id, developer_id, assigned_by)
        
        log_user_activity(assigned_by, "ASSIGN_TICKET", f"Assigned ticket {ticket_id} to developer {developer_id}")
        
        return True
    finally:
        close_conn(conn, cur)

def self_assign_ticket(ticket_id: int, developer_id: int) -> bool:
    conn, cur = get_cursor()
    try:
        # Verify ticket is available for self-assignment
        cur.execute("""
            SELECT status FROM tickets 
            WHERE id=%s AND assigned_developer_id IS NULL AND status='OPEN'
        """, (ticket_id,))
        
        if not cur.fetchone():
            return False
        
        # Self-assign ticket
        cur.execute("""
            UPDATE tickets 
            SET assigned_developer_id=%s, assigned_by=%s, assigned_at=NOW(), 
                assignment_notes='Self-assigned', status='IN_PROGRESS'
            WHERE id=%s
        """, (developer_id, developer_id, ticket_id))
        
        # Record in assignment history
        cur.execute("""
            INSERT INTO ticket_assignment_history(ticket_id, developer_id, assigned_by, assignment_notes, is_self_assigned)
            VALUES(%s, %s, %s, 'Self-assigned', TRUE)
        """, (ticket_id, developer_id, developer_id))
        
        log_user_activity(developer_id, "SELF_ASSIGN_TICKET", f"Self-assigned ticket {ticket_id}")
        
        return True
    finally:
        close_conn(conn, cur)

def complete_ticket_by_developer(ticket_id: int, developer_id: int, completion_notes: str) -> bool:
    conn, cur = get_cursor()
    try:
        # Verify ticket is assigned to this developer
        cur.execute("""
            SELECT user_id FROM tickets 
            WHERE id=%s AND assigned_developer_id=%s AND status='IN_PROGRESS'
        """, (ticket_id, developer_id))
        
        ticket = cur.fetchone()
        if not ticket:
            return False
        
        # Complete ticket
        cur.execute("""
            UPDATE tickets 
            SET status='CLOSED', completed_at=NOW(), completion_notes=%s, reply=%s
            WHERE id=%s
        """, (completion_notes, completion_notes, ticket_id))
        
        # Send enhanced notifications including email to client
        notify_ticket_completed(ticket_id, developer_id, ticket["user_id"])
        
        log_user_activity(developer_id, "COMPLETE_TICKET", f"Completed ticket {ticket_id}")
        
        return True
    finally:
        close_conn(conn, cur)

def verify_ticket_assignment(ticket_id: int, developer_id: int) -> bool:
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT id FROM tickets 
            WHERE id=%s AND assigned_developer_id=%s
        """, (ticket_id, developer_id))
        return cur.fetchone() is not None
    finally:
        close_conn(conn, cur)

def pass_ticket_by_developer(ticket_id: int, developer_id: int, reason: str) -> bool:
    """Developer passes ticket back to unassigned status"""
    conn, cur = get_cursor()
    try:
        # Verify ticket is assigned to this developer and get developer info
        cur.execute("""
            SELECT t.user_id, d.username as developer_name, d.email as developer_email
            FROM tickets t
            JOIN users d ON t.assigned_developer_id = d.id
            WHERE t.id=%s AND t.assigned_developer_id=%s
        """, (ticket_id, developer_id))
        
        ticket_info = cur.fetchone()
        if not ticket_info:
            return False
        
        # Pass ticket back to unassigned
        cur.execute("""
            UPDATE tickets 
            SET assigned_developer_id=NULL, assigned_by=NULL, assigned_at=NULL, 
                assignment_notes=%s, status='OPEN'
            WHERE id=%s
        """, (f"Passed by developer: {reason}", ticket_id))
        
        # Record in assignment history
        cur.execute("""
            UPDATE ticket_assignment_history 
            SET unassigned_at=NOW() 
            WHERE ticket_id=%s AND developer_id=%s AND unassigned_at IS NULL
        """, (ticket_id, developer_id))
        
        # Send notification to admins/PMs
        cur.execute("""
            INSERT INTO notifications(role, message, type) 
            VALUES('admin', %s, 'ticket_passed'), ('project_manager', %s, 'ticket_passed')
        """, (f"Ticket {ticket_id} passed back by developer: {reason}", 
              f"Ticket {ticket_id} passed back by developer: {reason}"))
        
        # Get admin and PM emails for email notifications
        cur.execute("""
            SELECT email FROM users 
            WHERE role IN ('admin', 'project_manager') AND is_active=TRUE AND email IS NOT NULL
        """)
        admin_emails = [row['email'] for row in cur.fetchall()]
        
        # Send email notifications to admins/PMs
        if admin_emails:
            try:
                from email_service import send_ticket_passed_email_to_admins
                send_ticket_passed_email_to_admins(
                    admin_emails, 
                    ticket_id, 
                    ticket_info['developer_name'], 
                    reason
                )
            except Exception as e:
                print(f"Failed to send pass ticket email notifications: {e}")
        
        log_user_activity(developer_id, "PASS_TICKET", f"Passed ticket {ticket_id}: {reason}")
        
        return True
    finally:
        close_conn(conn, cur)

def cancel_ticket_by_developer(ticket_id: int, developer_id: int, reason: str) -> bool:
    """Developer cancels ticket"""
    conn, cur = get_cursor()
    try:
        # Verify ticket is assigned to this developer and get client/developer info
        cur.execute("""
            SELECT t.user_id, c.username as client_name, c.email as client_email,
                   d.username as developer_name, d.email as developer_email
            FROM tickets t
            JOIN users c ON t.user_id = c.id
            JOIN users d ON t.assigned_developer_id = d.id
            WHERE t.id=%s AND t.assigned_developer_id=%s
        """, (ticket_id, developer_id))
        
        ticket_info = cur.fetchone()
        if not ticket_info:
            return False
        
        # Cancel ticket
        cur.execute("""
            UPDATE tickets 
            SET status='CLOSED', completed_at=NOW(), completion_notes=%s, reply=%s
            WHERE id=%s
        """, (f"Cancelled: {reason}", f"Ticket cancelled by developer: {reason}", ticket_id))
        
        # Send notification to client and admins
        cur.execute("""
            INSERT INTO notifications(user_id, message, type) 
            VALUES(%s, %s, 'ticket_cancelled')
        """, (ticket_info["user_id"], f"Your ticket {ticket_id} was cancelled: {reason}"))
        
        cur.execute("""
            INSERT INTO notifications(role, message, type) 
            VALUES('admin', %s, 'ticket_cancelled'), ('project_manager', %s, 'ticket_cancelled')
        """, (f"Ticket {ticket_id} cancelled by developer: {reason}", 
              f"Ticket {ticket_id} cancelled by developer: {reason}"))
        
        # Send email notification to client
        if ticket_info['client_email']:
            try:
                from email_service import send_ticket_cancelled_email_to_client
                send_ticket_cancelled_email_to_client(
                    ticket_info['client_email'],
                    ticket_info['client_name'],
                    ticket_id,
                    ticket_info['developer_name'],
                    reason
                )
            except Exception as e:
                print(f"Failed to send cancel ticket email notification to client: {e}")
        
        log_user_activity(developer_id, "CANCEL_TICKET", f"Cancelled ticket {ticket_id}: {reason}")
        
        return True
    finally:
        close_conn(conn, cur)

def update_ticket_status_by_developer(ticket_id: int, developer_id: int, status: str, notes: str = "") -> bool:
    """Developer updates ticket status"""
    conn, cur = get_cursor()
    try:
        # Verify ticket is assigned to this developer
        cur.execute("""
            SELECT user_id, status as current_status FROM tickets 
            WHERE id=%s AND assigned_developer_id=%s
        """, (ticket_id, developer_id))
        
        ticket = cur.fetchone()
        if not ticket:
            return False
        
        # Update ticket status
        if status == 'CLOSED':
            cur.execute("""
                UPDATE tickets 
                SET status=%s, completed_at=NOW(), completion_notes=%s, reply=%s
                WHERE id=%s
            """, (status, notes, notes, ticket_id))
        else:
            cur.execute("""
                UPDATE tickets 
                SET status=%s, assignment_notes=%s
                WHERE id=%s
            """, (status, notes, ticket_id))
        
        # Send notification if status changed to CLOSED
        if status == 'CLOSED':
            cur.execute("""
                INSERT INTO notifications(user_id, message, type) 
                VALUES(%s, %s, 'ticket_completed')
            """, (ticket["user_id"], f"Your ticket {ticket_id} has been completed"))
        
        log_user_activity(developer_id, "UPDATE_TICKET_STATUS", f"Updated ticket {ticket_id} status to {status}")
        
        return True
    finally:
        close_conn(conn, cur)

def get_ticket_with_access_control(ticket_id: int, user_id: int, user_role: str) -> Optional[Dict]:
    conn, cur = get_cursor()
    try:
        if user_role in ['admin', 'project_manager']:
            # Admin and PM can see all tickets
            where_clause = "t.id=%s"
            params = (ticket_id,)
        elif user_role == 'developer':
            # Developer can see assigned tickets or unassigned tickets
            where_clause = "t.id=%s AND (t.assigned_developer_id=%s OR t.assigned_developer_id IS NULL)"
            params = (ticket_id, user_id)
        elif user_role == 'client':
            # Client can only see their own tickets
            where_clause = "t.id=%s AND t.user_id=%s"
            params = (ticket_id, user_id)
        else:
            return None
        
        cur.execute(f"""
            SELECT t.*, 
                   c.username as client_name, c.email as client_email,
                   d.username as developer_name, d.email as developer_email,
                   a.username as assigned_by_name
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            LEFT JOIN users d ON t.assigned_developer_id = d.id
            LEFT JOIN users a ON t.assigned_by = a.id
            WHERE {where_clause}
        """, params)
        
        return cur.fetchone()
    finally:
        close_conn(conn, cur)

# ================= UTILITY FUNCTIONS =================
def log_user_activity(user_id: int, action: str, details: str = None):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            INSERT INTO user_activity_log(user_id, action, details) 
            VALUES(%s, %s, %s)
        """, (user_id, action, details))
    finally:
        close_conn(conn, cur)

def get_system_statistics() -> Dict:
    conn, cur = get_cursor()
    try:
        # User statistics
        cur.execute("""
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE is_active=TRUE 
            GROUP BY role
        """)
        user_stats = {row["role"]: row["count"] for row in cur.fetchall()}
        
        # Ticket statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN status='OPEN' THEN 1 END) as open_tickets,
                COUNT(CASE WHEN status='IN_PROGRESS' THEN 1 END) as in_progress_tickets,
                COUNT(CASE WHEN status='CLOSED' THEN 1 END) as closed_tickets,
                COUNT(CASE WHEN assigned_developer_id IS NULL THEN 1 END) as unassigned_tickets
            FROM tickets
        """)
        ticket_stats = cur.fetchone()
        
        return {
            "user_statistics": user_stats,
            "ticket_statistics": ticket_stats
        }
    finally:
        close_conn(conn, cur)

# ================= USER MANAGEMENT FUNCTIONS =================
def toggle_user_status(user_id: int, admin_id: int) -> bool:
    """Toggle user active/inactive status"""
    conn, cur = get_cursor()
    try:
        # Get current status
        cur.execute("SELECT is_active, username FROM users WHERE id=%s", (user_id,))
        user = cur.fetchone()
        if not user:
            return False
        
        # Don't allow deactivating self
        if user_id == admin_id:
            return False
        
        new_status = not user["is_active"]
        
        # Update status
        cur.execute("""
            UPDATE users 
            SET is_active=%s 
            WHERE id=%s
        """, (new_status, user_id))
        
        # Log activity
        action = "ACTIVATE_USER" if new_status else "DEACTIVATE_USER"
        log_user_activity(admin_id, action, f"{'Activated' if new_status else 'Deactivated'} user: {user['username']}")
        
        return True
    finally:
        close_conn(conn, cur)

def deactivate_user(user_id: int, admin_id: int) -> bool:
    """Deactivate a user"""
    conn, cur = get_cursor()
    try:
        # Don't allow deactivating self
        if user_id == admin_id:
            return False
        
        # Get username for logging
        cur.execute("SELECT username FROM users WHERE id=%s", (user_id,))
        user = cur.fetchone()
        if not user:
            return False
        
        # Deactivate user
        cur.execute("""
            UPDATE users 
            SET is_active=FALSE 
            WHERE id=%s
        """, (user_id,))
        
        # Log activity
        log_user_activity(admin_id, "DEACTIVATE_USER", f"Deactivated user: {user['username']}")
        
        return True
    finally:
        close_conn(conn, cur)

def activate_user(user_id: int, admin_id: int) -> bool:
    """Activate a user"""
    conn, cur = get_cursor()
    try:
        # Get username for logging
        cur.execute("SELECT username FROM users WHERE id=%s", (user_id,))
        user = cur.fetchone()
        if not user:
            return False
        
        # Activate user
        cur.execute("""
            UPDATE users 
            SET is_active=TRUE 
            WHERE id=%s
        """, (user_id,))
        
        # Log activity
        log_user_activity(admin_id, "ACTIVATE_USER", f"Activated user: {user['username']}")
        
        return True
    finally:
        close_conn(conn, cur)

def get_pending_user_approvals() -> List[Dict]:
    """Get users created by PMs that need admin approval"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT u.id, u.username, u.email, u.role, u.created_at,
                   pm.username as created_by_pm, pm.email as pm_email
            FROM users u
            JOIN users pm ON u.created_by = pm.id
            WHERE u.is_active=FALSE AND pm.role='project_manager'
            ORDER BY u.created_at DESC
        """)
        return cur.fetchall()
    finally:
        close_conn(conn, cur)

def approve_user_by_admin(user_id: int, admin_id: int) -> bool:
    """Admin approves a user created by PM"""
    conn, cur = get_cursor()
    try:
        # Get user details for logging
        cur.execute("SELECT username, created_by FROM users WHERE id=%s AND is_active=FALSE", (user_id,))
        user = cur.fetchone()
        if not user:
            return False
        
        # Activate user
        cur.execute("UPDATE users SET is_active=TRUE WHERE id=%s", (user_id,))
        
        # Create notification for the PM who created the user
        cur.execute("""
            INSERT INTO notifications(user_id, message, type) 
            VALUES(%s, %s, 'user_approved')
        """, (user["created_by"], f"User '{user['username']}' has been approved by admin"))
        
        # Create notification for the approved user
        cur.execute("""
            INSERT INTO notifications(user_id, message, type) 
            VALUES(%s, %s, 'account_activated')
        """, (user_id, "Your account has been activated. You can now log in."))
        
        log_user_activity(admin_id, "APPROVE_USER", f"Approved user: {user['username']}")
        
        return True
    finally:
        close_conn(conn, cur)

def get_all_users_with_status() -> Dict:
    """Get all users including inactive ones for admin management"""
    conn, cur = get_cursor()
    try:
        result = {}
        
        for role in ['admin', 'project_manager', 'developer', 'client']:
            cur.execute("""
                SELECT u.id, u.username, u.email, u.created_at, u.last_login, u.is_active,
                       COUNT(t.id) as total_tickets,
                       COUNT(CASE WHEN t.status='OPEN' THEN 1 END) as open_tickets
                FROM users u
                LEFT JOIN tickets t ON u.id = t.user_id OR u.id = t.assigned_developer_id
                WHERE u.role=%s
                GROUP BY u.id, u.username, u.email, u.created_at, u.last_login, u.is_active
                ORDER BY u.is_active DESC, u.username
            """, (role,))
            result[role] = cur.fetchall()
        
        return result
    finally:
        close_conn(conn, cur)

# ================= PM TEAM MANAGEMENT FUNCTIONS =================
def add_team_member(pm_id: int, member_id: int, member_role: str) -> bool:
    """PM adds a developer or client to their team"""
    conn, cur = get_cursor()
    try:
        # Verify PM exists and is active
        cur.execute("SELECT id FROM users WHERE id=%s AND role='project_manager' AND is_active=TRUE", (pm_id,))
        if not cur.fetchone():
            return False
        
        # Verify member exists and has correct role
        cur.execute("SELECT id FROM users WHERE id=%s AND role=%s AND is_active=TRUE", (member_id, member_role))
        if not cur.fetchone():
            return False
        
        # Check if already in team
        cur.execute("SELECT id FROM pm_teams WHERE pm_id=%s AND member_id=%s AND is_active=TRUE", (pm_id, member_id))
        if cur.fetchone():
            return False  # Already in team
        
        # Add to team
        cur.execute("""
            INSERT INTO pm_teams(pm_id, member_id, member_role) 
            VALUES(%s, %s, %s)
            ON DUPLICATE KEY UPDATE is_active=TRUE, added_at=NOW()
        """, (pm_id, member_id, member_role))
        
        # Update user's team_lead_id
        cur.execute("UPDATE users SET team_lead_id=%s WHERE id=%s", (pm_id, member_id))
        
        log_user_activity(pm_id, "ADD_TEAM_MEMBER", f"Added {member_role} {member_id} to team")
        
        return True
    finally:
        close_conn(conn, cur)

def remove_team_member(pm_id: int, member_id: int) -> bool:
    """PM removes a member from their team"""
    conn, cur = get_cursor()
    try:
        # Verify PM owns this team member
        cur.execute("SELECT id FROM pm_teams WHERE pm_id=%s AND member_id=%s AND is_active=TRUE", (pm_id, member_id))
        if not cur.fetchone():
            return False
        
        # Remove from team
        cur.execute("""
            UPDATE pm_teams 
            SET is_active=FALSE 
            WHERE pm_id=%s AND member_id=%s
        """, (pm_id, member_id))
        
        # Clear team_lead_id
        cur.execute("UPDATE users SET team_lead_id=NULL WHERE id=%s", (member_id,))
        
        log_user_activity(pm_id, "REMOVE_TEAM_MEMBER", f"Removed member {member_id} from team")
        
        return True
    finally:
        close_conn(conn, cur)

def get_pm_team_members(pm_id: int) -> Dict:
    """Get all team members for a specific PM"""
    conn, cur = get_cursor()
    try:
        result = {"developer": [], "client": []}
        
        cur.execute("""
            SELECT u.id, u.username, u.email, u.created_at, u.last_login, u.is_active,
                   pt.added_at, pt.member_role,
                   COUNT(t.id) as total_tickets,
                   COUNT(CASE WHEN t.status='OPEN' THEN 1 END) as open_tickets
            FROM pm_teams pt
            JOIN users u ON pt.member_id = u.id
            LEFT JOIN tickets t ON u.id = t.user_id OR u.id = t.assigned_developer_id
            WHERE pt.pm_id=%s AND pt.is_active=TRUE AND u.is_active=TRUE
            GROUP BY u.id, u.username, u.email, u.created_at, u.last_login, u.is_active, pt.added_at, pt.member_role
            ORDER BY pt.member_role, u.username
        """, (pm_id,))
        
        members = cur.fetchall()
        for member in members:
            role = member["member_role"]
            if role in result:
                result[role].append(member)
        
        return result
    finally:
        close_conn(conn, cur)

def get_available_users_for_pm_team(pm_id: int) -> Dict:
    """Get developers and clients not yet in PM's team"""
    conn, cur = get_cursor()
    try:
        result = {"developer": [], "client": []}
        
        for role in ["developer", "client"]:
            cur.execute("""
                SELECT u.id, u.username, u.email, u.created_at, u.last_login
                FROM users u
                WHERE u.role=%s AND u.is_active=TRUE
                AND u.id NOT IN (
                    SELECT member_id FROM pm_teams 
                    WHERE pm_id=%s AND is_active=TRUE
                )
                ORDER BY u.username
            """, (role, pm_id))
            result[role] = cur.fetchall()
        
        return result
    finally:
        close_conn(conn, cur)

def create_user_by_pm(username: str, password: str, email: str, role: str, pm_id: int) -> int:
    """PM creates new developer or client and adds them to their team (inactive by default, needs admin approval)"""
    conn, cur = get_cursor()
    try:
        if role not in ['developer', 'client']:
            raise ValueError("PM can only create developer or client users")
        
        # Create user as INACTIVE (needs admin approval)
        cur.execute("""
            INSERT INTO users(username, password, email, role, created_by, team_lead_id, is_active) 
            VALUES(%s, %s, %s, %s, %s, %s, FALSE)
        """, (username, password, email, role, pm_id, pm_id))
        
        user_id = cur.lastrowid
        
        # Add to PM's team
        cur.execute("""
            INSERT INTO pm_teams(pm_id, member_id, member_role) 
            VALUES(%s, %s, %s)
        """, (pm_id, user_id, role))
        
        # Get PM username for notification
        cur.execute("SELECT username FROM users WHERE id=%s", (pm_id,))
        pm_user = cur.fetchone()
        pm_username = pm_user["username"] if pm_user else f"PM {pm_id}"
        
        # Create notification for all admins
        cur.execute("""
            INSERT INTO notifications(role, message, type) 
            VALUES('admin', %s, 'user_approval_needed')
        """, (f"New {role} '{username}' created by PM {pm_username} needs approval",))
        
        log_user_activity(pm_id, "CREATE_TEAM_USER", f"Created {role} user: {username} (INACTIVE - needs admin approval)")
        
        return user_id
    finally:
        close_conn(conn, cur)

def get_developer_team_members(developer_id: int) -> Dict:
    """Get all team members for a developer (including PM and other team members)"""
    conn, cur = get_cursor()
    try:
        # First, find the PM for this developer
        cur.execute("""
            SELECT pm_id FROM pm_teams 
            WHERE member_id=%s AND is_active=TRUE
        """, (developer_id,))
        
        pm_result = cur.fetchone()
        if not pm_result:
            return {"project_manager": [], "developer": [], "client": []}
        
        pm_id = pm_result["pm_id"]
        
        result = {"project_manager": [], "developer": [], "client": []}
        
        # Get the PM
        cur.execute("""
            SELECT id, username, email, created_at, last_login, is_active, role
            FROM users 
            WHERE id=%s AND is_active=TRUE
        """, (pm_id,))
        
        pm_user = cur.fetchone()
        if pm_user:
            result["project_manager"].append(pm_user)
        
        # Get all team members (developers and clients)
        cur.execute("""
            SELECT u.id, u.username, u.email, u.created_at, u.last_login, u.is_active,
                   pt.added_at, pt.member_role,
                   COUNT(t.id) as total_tickets,
                   COUNT(CASE WHEN t.status='OPEN' THEN 1 END) as open_tickets
            FROM pm_teams pt
            JOIN users u ON pt.member_id = u.id
            LEFT JOIN tickets t ON u.id = t.user_id OR u.id = t.assigned_developer_id
            WHERE pt.pm_id=%s AND pt.is_active=TRUE AND u.is_active=TRUE
            GROUP BY u.id, u.username, u.email, u.created_at, u.last_login, u.is_active, pt.added_at, pt.member_role
            ORDER BY pt.member_role, u.username
        """, (pm_id,))
        
        members = cur.fetchall()
        for member in members:
            role = member["member_role"]
            if role in result:
                result[role].append(member)
        
        return result
    finally:
        close_conn(conn, cur)

def get_pm_dashboard_data(pm_id: int) -> Dict:
    """Enhanced PM dashboard with team-specific data"""
    conn, cur = get_cursor()
    try:
        # Get team member counts
        cur.execute("""
            SELECT member_role, COUNT(*) as count
            FROM pm_teams pt
            JOIN users u ON pt.member_id = u.id
            WHERE pt.pm_id=%s AND pt.is_active=TRUE AND u.is_active=TRUE
            GROUP BY member_role
        """, (pm_id,))
        team_counts = {row["member_role"]: row["count"] for row in cur.fetchall()}
        
        # Get unassigned tickets (only from team clients)
        cur.execute("""
            SELECT COUNT(*) as unassigned_tickets
            FROM tickets t
            JOIN pm_teams pt ON t.user_id = pt.member_id
            WHERE pt.pm_id=%s AND pt.is_active=TRUE AND pt.member_role='client'
            AND t.assigned_developer_id IS NULL AND t.status='OPEN'
        """, (pm_id,))
        unassigned_count = cur.fetchone()["unassigned_tickets"]
        
        # Get team developer workload
        cur.execute("""
            SELECT u.id, u.username,
                   COUNT(t.id) as assigned_tickets
            FROM pm_teams pt
            JOIN users u ON pt.member_id = u.id
            LEFT JOIN tickets t ON u.id = t.assigned_developer_id AND t.status IN ('OPEN', 'IN_PROGRESS')
            WHERE pt.pm_id=%s AND pt.is_active=TRUE AND pt.member_role='developer' AND u.is_active=TRUE
            GROUP BY u.id, u.username
            ORDER BY assigned_tickets ASC
        """, (pm_id,))
        developer_workload = cur.fetchall()
        
        return {
            "team_counts": team_counts,
            "unassigned_tickets": unassigned_count,
            "developer_workload": developer_workload
        }
    finally:
        close_conn(conn, cur)

# ================= CHAT HISTORY FUNCTIONS =================
def save_chat_interaction(user_id: int, message: str, response: str, confidence: float, ticket_created: bool = False, ticket_id: int = None) -> int:
    """Save a chat interaction to the database"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            INSERT INTO chat_history (user_id, message, response, confidence, ticket_created, ticket_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, message, response, confidence, ticket_created, ticket_id))
        
        chat_id = cur.lastrowid
        return chat_id
    except Exception as e:
        print(f"Error saving chat interaction: {e}")
        return 0
    finally:
        close_conn(conn, cur)

def get_client_chat_history(client_id: int, limit: int = 50) -> List[Dict]:
    """Get chat history for a specific client"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT 
                id,
                message,
                response,
                confidence,
                ticket_created,
                ticket_id,
                created_at
            FROM chat_history 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT %s
        """, (client_id, limit))
        
        history = cur.fetchall()
        return history or []
    except Exception as e:
        print(f"Error fetching chat history: {e}")
        return []
    finally:
        close_conn(conn, cur)

def get_recent_chat_interactions(limit: int = 100) -> List[Dict]:
    """Get recent chat interactions across all users (for admin analytics)"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT 
                ch.id,
                ch.message,
                ch.response,
                ch.confidence,
                ch.ticket_created,
                ch.ticket_id,
                ch.created_at,
                u.username,
                u.email
            FROM chat_history ch
            JOIN users u ON ch.user_id = u.id
            ORDER BY ch.created_at DESC 
            LIMIT %s
        """, (limit,))
        
        interactions = cur.fetchall()
        return interactions or []
    except Exception as e:
        print(f"Error fetching recent chat interactions: {e}")
        return []
    finally:
        close_conn(conn, cur)

def get_chat_analytics() -> Dict:
    """Get chat analytics for admin dashboard"""
    conn, cur = get_cursor()
    try:
        # Total interactions
        cur.execute("SELECT COUNT(*) as total FROM chat_history")
        total_chats = cur.fetchone()['total']
        
        # Tickets created by AI
        cur.execute("SELECT COUNT(*) as total FROM chat_history WHERE ticket_created = TRUE")
        ai_tickets = cur.fetchone()['total']
        
        # Average confidence
        cur.execute("SELECT AVG(confidence) as avg_confidence FROM chat_history")
        avg_confidence = cur.fetchone()['avg_confidence'] or 0.0
        
        # Recent activity (last 7 days)
        cur.execute("""
            SELECT COUNT(*) as recent 
            FROM chat_history 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        recent_activity = cur.fetchone()['recent']
        
        return {
            "total_interactions": total_chats,
            "ai_created_tickets": ai_tickets,
            "average_confidence": round(avg_confidence, 2),
            "recent_activity_7days": recent_activity,
            "automation_rate": round((total_chats - ai_tickets) / max(total_chats, 1) * 100, 1)
        }
    except Exception as e:
        print(f"Error fetching chat analytics: {e}")
        return {
            "total_interactions": 0,
            "ai_created_tickets": 0,
            "average_confidence": 0.0,
            "recent_activity_7days": 0,
            "automation_rate": 0.0
        }
    finally:
        close_conn(conn, cur)
# ================= NOTIFICATION FUNCTIONS =================
def create_notification(user_id: int = None, role: str = None, message: str = "", notification_type: str = "info", ticket_id: int = None) -> int:
    """Create a new notification for a specific user or role"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            INSERT INTO notifications (user_id, role, message, type, ticket_id)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, role, message, notification_type, ticket_id))
        
        notification_id = cur.lastrowid
        return notification_id
    except Exception as e:
        print(f"Error creating notification: {e}")
        return 0
    finally:
        close_conn(conn, cur)

def get_user_notifications(user_id: int, user_role: str, limit: int = 50) -> List[Dict]:
    """Get notifications for a specific user"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT 
                id,
                message,
                type,
                is_read,
                created_at,
                ticket_id
            FROM notifications 
            WHERE (user_id = %s OR role = %s)
            ORDER BY created_at DESC 
            LIMIT %s
        """, (user_id, user_role, limit))
        
        notifications = cur.fetchall()
        return notifications or []
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        return []
    finally:
        close_conn(conn, cur)

def mark_notification_as_read(notification_id: int, user_id: int) -> bool:
    """Mark a notification as read"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            UPDATE notifications 
            SET is_read = TRUE 
            WHERE id = %s AND (user_id = %s OR user_id IS NULL)
        """, (notification_id, user_id))
        
        return cur.rowcount > 0
    except Exception as e:
        print(f"Error marking notification as read: {e}")
        return False
    finally:
        close_conn(conn, cur)

def mark_all_notifications_as_read(user_id: int, user_role: str) -> int:
    """Mark all notifications as read for a user"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            UPDATE notifications 
            SET is_read = TRUE 
            WHERE (user_id = %s OR role = %s) AND is_read = FALSE
        """, (user_id, user_role))
        
        return cur.rowcount
    except Exception as e:
        print(f"Error marking all notifications as read: {e}")
        return 0
    finally:
        close_conn(conn, cur)

def delete_user_notification(notification_id: int, user_id: int) -> bool:
    """Delete a notification"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            DELETE FROM notifications 
            WHERE id = %s AND (user_id = %s OR user_id IS NULL)
        """, (notification_id, user_id))
        
        return cur.rowcount > 0
    except Exception as e:
        print(f"Error deleting notification: {e}")
        return False
    finally:
        close_conn(conn, cur)

def notify_ai_ticket_created(ticket_id: int, client_id: int, query: str) -> None:
    """Create notifications when AI creates a ticket"""
    try:
        # Get client details for email
        conn, cur = get_cursor()
        cur.execute("SELECT username, email FROM users WHERE id = %s", (client_id,))
        client = cur.fetchone()
        close_conn(conn, cur)
        
        # Send email to client
        if client and client['email']:
            from email_service import send_ticket_created_email
            send_ticket_created_email(
                client['email'], 
                client['username'], 
                ticket_id, 
                query
            )
        
        # Notify all admins
        create_notification(
            role="admin",
            message=f"🤖 AI Assistant created ticket #{ticket_id}: {query[:100]}...",
            notification_type="info",
            ticket_id=ticket_id
        )
        
        # Notify all project managers
        create_notification(
            role="project_manager", 
            message=f"🎫 New AI-generated ticket #{ticket_id} needs assignment",
            notification_type="warning",
            ticket_id=ticket_id
        )
        
        print(f"✅ Notifications sent for AI-created ticket #{ticket_id}")
    except Exception as e:
        print(f"Error sending AI ticket notifications: {e}")

def notify_ticket_assigned(ticket_id: int, developer_id: int, assigned_by: int) -> None:
    """Create notifications when a ticket is assigned"""
    try:
        # Get ticket and user details
        conn, cur = get_cursor()
        cur.execute("""
            SELECT t.query, t.user_id, u.username as client_name, u.email as client_email,
                   d.username as dev_name, a.username as assigned_by_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            JOIN users d ON %s = d.id
            JOIN users a ON %s = a.id
            WHERE t.id = %s
        """, (developer_id, assigned_by, ticket_id))
        
        ticket_info = cur.fetchone()
        close_conn(conn, cur)
        
        if ticket_info:
            # Send email to client
            if ticket_info['client_email']:
                from email_service import send_ticket_assigned_email
                send_ticket_assigned_email(
                    ticket_info['client_email'],
                    ticket_info['client_name'],
                    ticket_id,
                    ticket_info['dev_name']
                )
            
            # Notify the assigned developer
            create_notification(
                user_id=developer_id,
                message=f"📋 You've been assigned ticket #{ticket_id}: {ticket_info['query'][:80]}...",
                notification_type="info",
                ticket_id=ticket_id
            )
            
            # Notify admins about the assignment
            create_notification(
                role="admin",
                message=f"✅ Ticket #{ticket_id} assigned to {ticket_info['dev_name']} by {ticket_info['assigned_by_name']}",
                notification_type="success",
                ticket_id=ticket_id
            )
            
            print(f"✅ Assignment notifications sent for ticket #{ticket_id}")
    except Exception as e:
        print(f"Error sending assignment notifications: {e}")

def notify_ticket_completed(ticket_id: int, developer_id: int, client_id: int) -> None:
    """Create notifications when a ticket is completed"""
    try:
        # Get ticket details
        conn, cur = get_cursor()
        cur.execute("""
            SELECT t.query, t.completion_notes, u.username as client_name, u.email as client_email, 
                   d.username as dev_name
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            JOIN users d ON %s = d.id
            WHERE t.id = %s
        """, (developer_id, ticket_id))
        
        ticket_info = cur.fetchone()
        close_conn(conn, cur)
        
        if ticket_info:
            # Send email to client
            if ticket_info['client_email']:
                from email_service import send_ticket_completed_email
                send_ticket_completed_email(
                    ticket_info['client_email'],
                    ticket_info['client_name'],
                    ticket_id,
                    ticket_info['dev_name'],
                    ticket_info['completion_notes'] or "Issue resolved successfully."
                )
            
            # Notify admins and PMs
            create_notification(
                role="admin",
                message=f"✅ Ticket #{ticket_id} completed by {ticket_info['dev_name']}",
                notification_type="success",
                ticket_id=ticket_id
            )
            
            create_notification(
                role="project_manager",
                message=f"🎉 Ticket #{ticket_id} has been resolved by {ticket_info['dev_name']}",
                notification_type="success",
                ticket_id=ticket_id
            )
            
            print(f"✅ Completion notifications sent for ticket #{ticket_id}")
    except Exception as e:
        print(f"Error sending completion notifications: {e}")
# ================= USER SETTINGS FUNCTIONS =================
def get_user_settings_data(user_id: int) -> Dict:
    """Get user settings and preferences"""
    conn, cur = get_cursor()
    try:
        # Get user basic info
        cur.execute("""
            SELECT username, email, role 
            FROM users 
            WHERE id = %s
        """, (user_id,))
        
        user_info = cur.fetchone()
        if not user_info:
            return {}
        
        # Check if user_settings table exists, if not create it
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_settings(
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                email_notifications BOOLEAN DEFAULT TRUE,
                notification_preferences JSON DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_settings (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Get user settings
        cur.execute("""
            SELECT email_notifications, notification_preferences 
            FROM user_settings 
            WHERE user_id = %s
        """, (user_id,))
        
        settings_row = cur.fetchone()
        
        # Default notification preferences
        default_preferences = {
            "ticket_created": True,
            "ticket_assigned": True,
            "ticket_completed": True,
            "system_updates": False
        }
        
        if settings_row:
            try:
                import json
                preferences = json.loads(settings_row['notification_preferences']) if settings_row['notification_preferences'] else default_preferences
            except:
                preferences = default_preferences
            
            return {
                "username": user_info['username'],
                "email": user_info['email'] or "",
                "role": user_info['role'],
                "email_notifications": bool(settings_row['email_notifications']),
                "notification_preferences": preferences
            }
        else:
            # Create default settings
            cur.execute("""
                INSERT INTO user_settings (user_id, email_notifications, notification_preferences)
                VALUES (%s, TRUE, %s)
            """, (user_id, json.dumps(default_preferences)))
            
            return {
                "username": user_info['username'],
                "email": user_info['email'] or "",
                "role": user_info['role'],
                "email_notifications": True,
                "notification_preferences": default_preferences
            }
            
    except Exception as e:
        print(f"Error getting user settings: {e}")
        return {}
    finally:
        close_conn(conn, cur)

def update_user_settings_data(user_id: int, settings_data: Dict) -> bool:
    """Update user settings and preferences"""
    conn, cur = get_cursor()
    try:
        import json
        
        # Update email in users table if provided
        if 'email' in settings_data:
            cur.execute("""
                UPDATE users 
                SET email = %s 
                WHERE id = %s
            """, (settings_data['email'], user_id))
        
        # Ensure user_settings table exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_settings(
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                email_notifications BOOLEAN DEFAULT TRUE,
                notification_preferences JSON DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_settings (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Update or insert settings
        email_notifications = settings_data.get('email_notifications', True)
        notification_preferences = json.dumps(settings_data.get('notification_preferences', {}))
        
        cur.execute("""
            INSERT INTO user_settings (user_id, email_notifications, notification_preferences)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
            email_notifications = VALUES(email_notifications),
            notification_preferences = VALUES(notification_preferences),
            updated_at = CURRENT_TIMESTAMP
        """, (user_id, email_notifications, notification_preferences))
        
        return True
        
    except Exception as e:
        print(f"Error updating user settings: {e}")
        return False
    finally:
        close_conn(conn, cur)

# ================= ACTIVE TICKETS FOR VISIBILITY =================
def get_active_tickets_for_staff() -> List[Dict]:
    """Get all active (open and in-progress) tickets for staff roles (admin, PM, developer)"""
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT 
                t.id,
                t.user_id,
                t.query,
                t.reply,
                t.status,
                t.priority,
                t.assigned_developer_id as assignedDeveloperId,
                t.assigned_by,
                t.assigned_at as assignedAt,
                t.assignment_notes as assignmentNotes,
                t.completed_at as completedAt,
                t.completion_notes as completionNotes,
                t.created_at as createdAt,
                t.updated_at as updatedAt,
                client.username as clientName,
                dev.username as developerName,
                assigner.username as assignedByName
            FROM tickets t
            LEFT JOIN users client ON t.user_id = client.id
            LEFT JOIN users dev ON t.assigned_developer_id = dev.id
            LEFT JOIN users assigner ON t.assigned_by = assigner.id
            WHERE t.status IN ('OPEN', 'IN_PROGRESS')
            ORDER BY 
                CASE t.priority 
                    WHEN 'CRITICAL' THEN 1 
                    WHEN 'HIGH' THEN 2 
                    WHEN 'MEDIUM' THEN 3 
                    WHEN 'LOW' THEN 4 
                END,
                t.created_at DESC
        """)
        
        tickets = cur.fetchall()
        return tickets or []
    except Exception as e:
        print(f"Error fetching active tickets for staff: {e}")
        return []
    finally:
        close_conn(conn, cur)