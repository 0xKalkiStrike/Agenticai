#!/usr/bin/env python3
"""
Simple Localhost WAMP Setup Script
Sets up the database for local development with WAMP server
"""

import mysql.connector
from mysql.connector import Error
import json

def create_database_and_tables():
    """Create database and all required tables for localhost WAMP setup"""
    
    # WAMP default connection (no password for root)
    connection_config = {
        'host': 'localhost',
        'user': 'root',
        'password': '',  # WAMP default - no password
        'port': 3306
    }
    
    try:
        # Connect to MySQL server
        connection = mysql.connector.connect(**connection_config)
        cursor = connection.cursor()
        
        print("🔌 Connected to MySQL server (WAMP)")
        
        # Create database
        cursor.execute("CREATE DATABASE IF NOT EXISTS agentic_ai")
        cursor.execute("USE agentic_ai")
        print("📁 Database 'agentic_ai' created/selected")
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                role ENUM('admin', 'project_manager', 'developer', 'client') NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("👥 Users table created")
        
        # Create tickets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                query TEXT NOT NULL,
                reply TEXT,
                status ENUM('OPEN', 'IN_PROGRESS', 'CLOSED') DEFAULT 'OPEN',
                priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
                assigned_to INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (assigned_to) REFERENCES users(id)
            )
        """)
        print("🎫 Tickets table created")
        
        # Create notifications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role VARCHAR(50),
                user_id INT,
                message TEXT NOT NULL,
                notification_type VARCHAR(50) DEFAULT 'general',
                ticket_id INT,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (ticket_id) REFERENCES tickets(id)
            )
        """)
        print("🔔 Notifications table created")
        
        # Create stats table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stats (
                id INT PRIMARY KEY DEFAULT 1,
                total_tickets INT DEFAULT 0,
                ai_resolved INT DEFAULT 0,
                human_resolved INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        
        # Insert default stats row
        cursor.execute("INSERT IGNORE INTO stats (id) VALUES (1)")
        print("📊 Stats table created")
        
        # Create knowledge base table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_base (
                id INT AUTO_INCREMENT PRIMARY KEY,
                keywords JSON,
                answer TEXT NOT NULL,
                category VARCHAR(100) DEFAULT 'general',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("📚 Knowledge base table created")
        
        # Create AI tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_conversations (
                id VARCHAR(255) PRIMARY KEY,
                user_id INT NOT NULL,
                session_id VARCHAR(255),
                conversation_context JSON,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                total_messages INT DEFAULT 0,
                resolution_type VARCHAR(50),
                satisfaction_rating INT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("🤖 AI conversations table created")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_conversation_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversation_id VARCHAR(255) NOT NULL,
                message_id VARCHAR(255) NOT NULL,
                sender_type ENUM('user', 'ai') NOT NULL,
                message_content TEXT NOT NULL,
                message_metadata JSON,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id)
            )
        """)
        print("💬 AI conversation messages table created")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_query_metrics (
                id VARCHAR(255) PRIMARY KEY,
                conversation_id VARCHAR(255),
                message_id VARCHAR(255),
                user_id INT,
                query_text TEXT,
                classification_result VARCHAR(100),
                confidence_score FLOAT,
                processing_time_ms INT,
                resolution_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("📈 AI query metrics table created")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_ticket_metadata (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_id INT NOT NULL,
                ai_generated BOOLEAN DEFAULT FALSE,
                ai_analysis TEXT,
                original_query TEXT,
                conversation_id VARCHAR(255),
                auto_classification VARCHAR(100),
                confidence_score FLOAT,
                suggested_priority VARCHAR(20),
                ai_suggested_category VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id)
            )
        """)
        print("🎯 AI ticket metadata table created")
        
        # Create user settings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                email VARCHAR(255) DEFAULT '',
                email_notifications BOOLEAN DEFAULT TRUE,
                browser_notifications BOOLEAN DEFAULT TRUE,
                ticket_assignment_notifications BOOLEAN DEFAULT TRUE,
                ticket_update_notifications BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_settings (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        print("⚙️ User settings table created")
        
        # Insert default admin user
        cursor.execute("""
            INSERT IGNORE INTO users (username, password, email, role) 
            VALUES ('Admin', 'Admin123', 'admin@localhost.com', 'admin')
        """)
        
        # Insert sample users
        cursor.execute("""
            INSERT IGNORE INTO users (username, password, email, role) 
            VALUES 
            ('TestClient', 'client123', 'client@localhost.com', 'client'),
            ('TestDev', 'dev123', 'dev@localhost.com', 'developer'),
            ('TestPM', 'pm123', 'pm@localhost.com', 'project_manager')
        """)
        print("👤 Default users created")
        
        # Insert sample knowledge base entries
        sample_kb = [
            {
                "keywords": ["password", "reset", "forgot"],
                "answer": "To reset your password, please contact your administrator or use the 'Forgot Password' link on the login page.",
                "category": "account"
            },
            {
                "keywords": ["email", "not", "working", "outlook"],
                "answer": "For email issues, please check your internet connection and verify your email settings. If the problem persists, contact IT support.",
                "category": "technical"
            },
            {
                "keywords": ["printer", "not", "printing", "paper", "jam"],
                "answer": "For printer issues, check if there's paper in the tray, clear any paper jams, and ensure the printer is connected to the network.",
                "category": "technical"
            }
        ]
        
        for entry in sample_kb:
            cursor.execute("""
                INSERT IGNORE INTO knowledge_base (keywords, answer, category)
                VALUES (%s, %s, %s)
            """, (json.dumps(entry["keywords"]), entry["answer"], entry["category"]))
        
        print("📖 Sample knowledge base entries added")
        
        connection.commit()
        print("\n✅ WAMP localhost setup completed successfully!")
        print("\n📋 Setup Summary:")
        print("   - Database: agentic_ai")
        print("   - Admin user: Admin / Admin123")
        print("   - Test users created for all roles")
        print("   - All tables created and configured")
        print("\n🚀 You can now run:")
        print("   - Backend: py backend/app/main.py")
        print("   - Frontend: npm run dev")
        print("   - Access phpMyAdmin at: http://localhost/phpmyadmin")
        
    except Error as e:
        print(f"❌ Error: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()
            print("🔌 MySQL connection closed")

if __name__ == "__main__":
    create_database_and_tables()