import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import os
from datetime import datetime
import mysql.connector
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ================= SMTP CONFIGURATION =================
SMTP_CONFIG = {
    "server": os.getenv("SMTP_SERVER", "smtp.gmail.com"),
    "port": int(os.getenv("SMTP_PORT", "587")),
    "username": os.getenv("SMTP_USERNAME", "root29583@gmail.com"),
    "password": os.getenv("SMTP_PASSWORD", "buay dita kxkp fars"),
    "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true"
}

# Default sender info
DEFAULT_SENDER = {
    "name": "Enhanced RBAC System",
    "email": SMTP_CONFIG["username"]
}

class EmailNotifier:
    def __init__(self):
        self.reload_config()
        
    def reload_config(self):
        """Reload configuration from environment variables"""
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        load_dotenv(env_path, override=True)
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.username = os.getenv("SMTP_USERNAME", "")
        self.password = os.getenv("SMTP_PASSWORD", "")
        self.use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        
        # Update global config for consistency
        global SMTP_CONFIG
        SMTP_CONFIG["server"] = self.smtp_server
        SMTP_CONFIG["port"] = self.smtp_port
        SMTP_CONFIG["username"] = self.username
        SMTP_CONFIG["password"] = self.password
        SMTP_CONFIG["use_tls"] = self.use_tls

    def _get_db_connection(self):
        """Get database connection"""
        return mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='agentic_ai'
        )
    
    def _create_email_message(self, to_email: str, subject: str, body: str, html_body: str = None) -> MIMEMultipart:
        """Create email message"""
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{DEFAULT_SENDER['name']} <{DEFAULT_SENDER['email']}>"
        message["To"] = to_email
        
        # Add plain text part
        text_part = MIMEText(body, "plain")
        message.attach(text_part)
        
        # Add HTML part if provided
        if html_body:
            html_part = MIMEText(html_body, "html")
            message.attach(html_part)
        
        return message
    
    def send_email(self, to_email: str, subject: str, body: str, html_body: str = None) -> bool:
        """Send email via SMTP"""
        # Always reload config to ensure latest settings are used
        self.reload_config()
        
        if not self.username or not self.password:
            print("❌ SMTP credentials not configured")
            print("💡 Please configure SMTP settings in backend/.env file")
            print("📧 For Gmail: Use App Password, not regular password")
            return False
        
        # Demo mode - if password is placeholder, simulate success
        if self.password == "your-app-password-here":
            print("🧪 DEMO MODE: Email would be sent to", to_email)
            print("📧 Subject:", subject)
            print("📝 Body preview:", body[:100] + "..." if len(body) > 100 else body)
            return True
        
        try:
            # Create message
            message = self._create_email_message(to_email, subject, body, html_body)
            
            # Create SMTP session
            if self.use_tls:
                context = ssl.create_default_context()
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls(context=context)
            else:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port)
            
            # Login and send email
            server.login(self.username, self.password)
            server.send_message(message)
            server.quit()
            
            print(f"✅ Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {str(e)}")
            if "authentication failed" in str(e).lower():
                print("💡 Gmail users: Use App Password instead of regular password")
                print("💡 Enable 2-Factor Authentication first, then generate App Password")
            elif "connection" in str(e).lower():
                print("💡 Check your internet connection and firewall settings")
            return False
    
    def get_notification_emails(self, roles: List[str] = None) -> List[str]:
        """Get email addresses for users who should receive notifications"""
        if roles is None:
            roles = ['admin', 'project_manager']
        
        try:
            conn = self._get_db_connection()
            cur = conn.cursor(dictionary=True)
            
            # Get emails from notification_channels table
            placeholders = ','.join(['%s'] * len(roles))
            cur.execute(f"""
                SELECT DISTINCT nc.channel_value as email, u.username, u.role
                FROM notification_channels nc
                JOIN users u ON nc.user_id = u.id
                WHERE nc.channel_type = 'email' 
                AND nc.is_active = 1 
                AND u.role IN ({placeholders})
                AND u.deleted_at IS NULL
            """, roles)
            
            email_data = cur.fetchall()
            emails = [row['email'] for row in email_data if row['email']]
            
            conn.close()
            return emails
            
        except Exception as e:
            print(f"❌ Error getting notification emails: {e}")
            return []
    
    def notify_ticket_created(self, ticket_id: int, client_username: str, query: str, priority: str):
        """Send notification when a new ticket is created"""
        emails = self.get_notification_emails()
        if not emails:
            print("⚠️ No email addresses configured for notifications")
            return
        
        subject = f"🎫 New Ticket #{ticket_id} - {priority} Priority"
        
        body = f"""
New Support Ticket Created

Ticket ID: #{ticket_id}
Client: {client_username}
Priority: {priority}
Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Query:
{query}

Please login to the Enhanced RBAC Dashboard to assign and manage this ticket.

---
Enhanced RBAC System
        """.strip()
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                    🎫 New Support Ticket Created
                </h2>
                
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                    <p><strong>Client:</strong> {client_username}</p>
                    <p><strong>Priority:</strong> <span style="color: {'#dc2626' if priority == 'HIGH' or priority == 'CRITICAL' else '#f59e0b' if priority == 'MEDIUM' else '#10b981'};">{priority}</span></p>
                    <p><strong>Created:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
                
                <div style="background: #fff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #374151;">Client Query:</h3>
                    <p style="background: #f9fafb; padding: 10px; border-left: 4px solid #2563eb; margin: 0;">{query}</p>
                </div>
                
                <div style="margin-top: 30px; padding: 15px; background: #eff6ff; border-radius: 8px;">
                    <p style="margin: 0; text-align: center;">
                        <strong>Please login to the Enhanced RBAC Dashboard to assign and manage this ticket.</strong>
                    </p>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="text-align: center; color: #6b7280; font-size: 12px;">
                    Enhanced RBAC System - Automated Notification
                </p>
            </div>
        </body>
        </html>
        """
        
        # Send to all configured emails
        for email in emails:
            self.send_email(email, subject, body, html_body)
    
    def notify_ticket_assigned(self, ticket_id: int, developer_name: str, assigned_by: str, client_username: str):
        """Send notification when a ticket is assigned"""
        emails = self.get_notification_emails()
        if not emails:
            return
        
        subject = f"📋 Ticket #{ticket_id} Assigned to {developer_name}"
        
        body = f"""
Ticket Assignment Notification

Ticket ID: #{ticket_id}
Assigned to: {developer_name}
Assigned by: {assigned_by}
Client: {client_username}
Assigned: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

The ticket has been successfully assigned and is now being handled.

---
Enhanced RBAC System
        """.strip()
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #059669; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                    📋 Ticket Assignment Notification
                </h2>
                
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
                    <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                    <p><strong>Assigned to:</strong> {developer_name}</p>
                    <p><strong>Assigned by:</strong> {assigned_by}</p>
                    <p><strong>Client:</strong> {client_username}</p>
                    <p><strong>Assigned:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
                
                <div style="margin-top: 30px; padding: 15px; background: #f0fdf4; border-radius: 8px;">
                    <p style="margin: 0; text-align: center;">
                        ✅ <strong>The ticket has been successfully assigned and is now being handled.</strong>
                    </p>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="text-align: center; color: #6b7280; font-size: 12px;">
                    Enhanced RBAC System - Automated Notification
                </p>
            </div>
        </body>
        </html>
        """
        
        for email in emails:
            self.send_email(email, subject, body, html_body)
    
    def notify_ticket_completed(self, ticket_id: int, developer_name: str, client_username: str, resolution: str):
        """Send notification when a ticket is completed"""
        emails = self.get_notification_emails()
        if not emails:
            return
        
        subject = f"✅ Ticket #{ticket_id} Completed"
        
        body = f"""
Ticket Completion Notification

Ticket ID: #{ticket_id}
Completed by: {developer_name}
Client: {client_username}
Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Resolution:
{resolution}

The ticket has been successfully resolved and closed.

---
Enhanced RBAC System
        """.strip()
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #10b981; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                    ✅ Ticket Completion Notification
                </h2>
                
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                    <p><strong>Completed by:</strong> {developer_name}</p>
                    <p><strong>Client:</strong> {client_username}</p>
                    <p><strong>Completed:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
                
                <div style="background: #fff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #374151;">Resolution:</h3>
                    <p style="background: #f0fdf4; padding: 10px; border-left: 4px solid #10b981; margin: 0;">{resolution}</p>
                </div>
                
                <div style="margin-top: 30px; padding: 15px; background: #f0fdf4; border-radius: 8px;">
                    <p style="margin: 0; text-align: center;">
                        🎉 <strong>The ticket has been successfully resolved and closed.</strong>
                    </p>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="text-align: center; color: #6b7280; font-size: 12px;">
                    Enhanced RBAC System - Automated Notification
                </p>
            </div>
        </body>
        </html>
        """
        
        for email in emails:
            self.send_email(email, subject, body, html_body)
    
    def test_email_configuration(self, test_email: str = None) -> bool:
        """Test email configuration"""
        if not test_email:
            test_email = self.username
        
        subject = "🧪 SMTP Configuration Test"
        body = f"""
This is a test email from the Enhanced RBAC System.

SMTP Configuration:
- Server: {self.smtp_server}
- Port: {self.smtp_port}
- Username: {self.username}
- TLS: {self.use_tls}

If you received this email, your SMTP configuration is working correctly!

Test sent at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---
Enhanced RBAC System
        """.strip()
        
        return self.send_email(test_email, subject, body)

# Global instance
email_notifier = EmailNotifier()

# Convenience functions
def send_notification_email(to_email: str, subject: str, body: str, html_body: str = None) -> bool:
    """Send a notification email"""
    return email_notifier.send_email(to_email, subject, body, html_body)

def notify_new_ticket(ticket_id: int, client_username: str, query: str, priority: str):
    """Notify about new ticket creation"""
    email_notifier.notify_ticket_created(ticket_id, client_username, query, priority)

def notify_ticket_assignment(ticket_id: int, developer_name: str, assigned_by: str, client_username: str):
    """Notify about ticket assignment"""
    email_notifier.notify_ticket_assigned(ticket_id, developer_name, assigned_by, client_username)

def notify_ticket_completion(ticket_id: int, developer_name: str, client_username: str, resolution: str):
    """Notify about ticket completion"""
    email_notifier.notify_ticket_completed(ticket_id, developer_name, client_username, resolution)

def test_smtp_config(test_email: str = None) -> bool:
    """Test SMTP configuration"""
    return email_notifier.test_email_configuration(test_email)

if __name__ == "__main__":
    # Test the email system
    print("🧪 Testing Email Notification System...")
    result = test_smtp_config()
    if result:
        print("✅ Email system is working!")
    else:
        print("❌ Email system needs configuration")
