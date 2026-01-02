import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

# Email configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "root29583@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "buay dita kxkp fars")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)

def send_email(to_email: str, subject: str, body: str, is_html: bool = False) -> bool:
    """Send an email notification"""
    try:
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            print("⚠️ Email not configured - SMTP credentials missing")
            return False
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add body
        msg.attach(MIMEText(body, 'html' if is_html else 'plain'))
        
        # Connect and send
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        
        text = msg.as_string()
        server.sendmail(FROM_EMAIL, to_email, text)
        server.quit()
        
        print(f"✅ Email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        return False

def send_ticket_created_email(client_email: str, client_name: str, ticket_id: int, query: str) -> bool:
    """Send email notification when AI creates a ticket for a client"""
    subject = f"🎫 Support Ticket #{ticket_id} Created - AI Assistant"
    
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">🤖 AI Assistant - Ticket Created</h2>
            
            <p>Hello <strong>{client_name}</strong>,</p>
            
            <p>Our AI Assistant has automatically created a support ticket for your query:</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
                <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                <p><strong>Your Query:</strong></p>
                <p style="font-style: italic;">"{query}"</p>
            </div>
            
            <p>Our expert support team has been notified and will review your ticket shortly. You'll receive another email once a developer is assigned to help you.</p>
            
            <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #059669; margin-top: 0;">💡 What happens next?</h3>
                <ul style="margin: 10px 0;">
                    <li>A project manager will review and assign your ticket</li>
                    <li>A developer will be assigned to work on your issue</li>
                    <li>You'll receive email updates on progress</li>
                    <li>You can continue chatting with our AI for other questions</li>
                </ul>
            </div>
            
            <p>Thank you for using our AI-powered support system!</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                This is an automated message from our AI Assistant. Please do not reply to this email.
            </p>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, body, is_html=True)

def send_ticket_assigned_email(client_email: str, client_name: str, ticket_id: int, developer_name: str) -> bool:
    """Send email notification when a ticket is assigned to a developer"""
    subject = f"👨‍💻 Developer Assigned to Ticket #{ticket_id}"
    
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #059669;">👨‍💻 Developer Assigned</h2>
            
            <p>Hello <strong>{client_name}</strong>,</p>
            
            <p>Great news! Your support ticket has been assigned to one of our expert developers.</p>
            
            <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
                <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                <p><strong>Assigned Developer:</strong> {developer_name}</p>
                <p><strong>Status:</strong> In Progress</p>
            </div>
            
            <p>Our developer is now working on your issue and will provide updates as they make progress. You can expect to hear back soon with either a solution or questions for more details.</p>
            
            <p>Thank you for your patience!</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                This is an automated notification. Please do not reply to this email.
            </p>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, body, is_html=True)

def send_ticket_completed_email(client_email: str, client_name: str, ticket_id: int, developer_name: str, solution: str) -> bool:
    """Send email notification when a ticket is completed"""
    subject = f"✅ Ticket #{ticket_id} Resolved"
    
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #059669;">✅ Ticket Resolved</h2>
            
            <p>Hello <strong>{client_name}</strong>,</p>
            
            <p>Excellent news! Your support ticket has been successfully resolved.</p>
            
            <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
                <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                <p><strong>Resolved by:</strong> {developer_name}</p>
                <p><strong>Status:</strong> Completed</p>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">💡 Solution:</h3>
                <p>{solution}</p>
            </div>
            
            <p>If you have any questions about this solution or need further assistance, feel free to chat with our AI Assistant again!</p>
            
            <p>Thank you for using our support system!</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                This is an automated notification. Please do not reply to this email.
            </p>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, body, is_html=True)

def send_ticket_passed_email_to_admins(admin_emails: list, ticket_id: int, developer_name: str, reason: str) -> bool:
    """Send email notification to admins/PMs when a ticket is passed"""
    subject = f"🔄 Ticket #{ticket_id} Passed by Developer"
    
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #f59e0b;">🔄 Ticket Passed for Reassignment</h2>
            
            <p>A developer has passed a ticket back for reassignment.</p>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                <p><strong>Developer:</strong> {developer_name}</p>
                <p><strong>Status:</strong> Passed (Needs Reassignment)</p>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📝 Developer's Reason:</h3>
                <p>{reason}</p>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">⚠️ Action Required</h3>
                <p>This ticket needs to be reassigned to another developer. Please review the developer's reason and assign it to an appropriate team member.</p>
            </div>
            
            <p>Please log into the admin dashboard to reassign this ticket.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                This is an automated notification from the ticket management system.
            </p>
        </div>
    </body>
    </html>
    """
    
    success = True
    for email in admin_emails:
        if not send_email(email, subject, body, is_html=True):
            success = False
    
    return success

def send_ticket_cancelled_email_to_client(client_email: str, client_name: str, ticket_id: int, developer_name: str, reason: str) -> bool:
    """Send email notification to client when a ticket is cancelled"""
    subject = f"❌ Ticket #{ticket_id} Cancelled"
    
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc2626;">❌ Ticket Cancelled</h2>
            
            <p>Hello <strong>{client_name}</strong>,</p>
            
            <p>We're writing to inform you that your support ticket has been cancelled by our development team.</p>
            
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                <p><strong>Ticket ID:</strong> #{ticket_id}</p>
                <p><strong>Developer:</strong> {developer_name}</p>
                <p><strong>Status:</strong> Cancelled</p>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📝 Developer's Explanation:</h3>
                <p>{reason}</p>
            </div>
            
            <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="color: #059669; margin-top: 0;">💡 What's Next?</h3>
                <ul style="margin: 10px 0;">
                    <li>If you have questions about this cancellation, please contact our support team</li>
                    <li>You can create a new ticket if you still need assistance</li>
                    <li>Our AI Assistant is available 24/7 to help with other questions</li>
                </ul>
            </div>
            
            <p>We apologize for any inconvenience and appreciate your understanding.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #6b7280;">
                This is an automated notification. If you have questions, please contact our support team.
            </p>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, body, is_html=True)