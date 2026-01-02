-- ================================================================
-- AI ASSISTANT DATABASE SCHEMA
-- Enhanced schema for Intelligent AI Support Assistant
-- ================================================================

USE agentic_ai;

-- ================================================================
-- AI CONVERSATIONS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    conversation_context JSON,
    total_messages INT DEFAULT 0,
    resolution_type ENUM('auto_resolved', 'ticket_created', 'escalated', 'abandoned') NULL,
    satisfaction_rating INT NULL CHECK (satisfaction_rating BETWEEN 1 AND 5),
    feedback_comments TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_id (session_id),
    INDEX idx_started_at (started_at),
    INDEX idx_resolution_type (resolution_type)
) ENGINE=InnoDB;

-- ================================================================
-- AI CONVERSATION MESSAGES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL,
    message_id VARCHAR(36) NOT NULL UNIQUE,
    sender_type ENUM('user', 'ai', 'system') NOT NULL,
    message_content TEXT NOT NULL,
    message_metadata JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confidence_score DECIMAL(3,2) NULL,
    intent_classification VARCHAR(100) NULL,
    entities_extracted JSON NULL,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_sender_type (sender_type)
) ENGINE=InnoDB;

-- ================================================================
-- AI KNOWLEDGE BASE ENHANCED
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_entries (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    tags JSON,
    difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    usage_count INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by ENUM('ai', 'human') DEFAULT 'human',
    source_tickets JSON,
    related_entries JSON,
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    INDEX idx_category (category),
    INDEX idx_difficulty (difficulty),
    INDEX idx_success_rate (success_rate),
    INDEX idx_is_active (is_active),
    FULLTEXT idx_content (title, content)
) ENGINE=InnoDB;

-- ================================================================
-- AI SOLUTION PATTERNS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_solution_patterns (
    id VARCHAR(36) PRIMARY KEY,
    query_pattern TEXT NOT NULL,
    solution_template TEXT NOT NULL,
    pattern_variables JSON,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
    last_used TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_confidence_threshold (confidence_threshold),
    INDEX idx_success_count (success_count),
    INDEX idx_last_used (last_used),
    FULLTEXT idx_query_pattern (query_pattern)
) ENGINE=InnoDB;

-- ================================================================
-- AI QUERY METRICS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_query_metrics (
    id VARCHAR(36) PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL,
    message_id VARCHAR(36) NOT NULL,
    user_id INT NOT NULL,
    query_text TEXT NOT NULL,
    classification_result ENUM('auto_resolvable', 'requires_developer', 'unclear') NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    processing_time_ms INT NOT NULL,
    resolution_type ENUM('auto_resolved', 'ticket_created', 'escalated') NULL,
    resolution_time_seconds INT NULL,
    user_satisfaction INT NULL CHECK (user_satisfaction BETWEEN 1 AND 5),
    feedback_provided BOOLEAN DEFAULT FALSE,
    ticket_id INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_classification_result (classification_result),
    INDEX idx_confidence_score (confidence_score),
    INDEX idx_resolution_type (resolution_type),
    INDEX idx_user_satisfaction (user_satisfaction)
) ENGINE=InnoDB;

-- ================================================================
-- AI SYSTEM PERFORMANCE TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_system_performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_queries INT DEFAULT 0,
    auto_resolved_queries INT DEFAULT 0,
    tickets_created INT DEFAULT 0,
    escalated_queries INT DEFAULT 0,
    average_confidence DECIMAL(5,2) DEFAULT 0.00,
    average_satisfaction DECIMAL(3,2) DEFAULT 0.00,
    classification_accuracy DECIMAL(5,2) DEFAULT 0.00,
    average_response_time_ms INT DEFAULT 0,
    knowledge_base_hits INT DEFAULT 0,
    pattern_matches INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_date (date)
) ENGINE=InnoDB;

-- ================================================================
-- AI ENHANCED TICKETS TABLE (Extension)
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_ticket_metadata (
    ticket_id INT PRIMARY KEY,
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_analysis TEXT NULL,
    original_query TEXT NULL,
    conversation_id VARCHAR(36) NULL,
    auto_classification VARCHAR(100) NULL,
    confidence_score DECIMAL(3,2) NULL,
    suggested_priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NULL,
    ai_suggested_category VARCHAR(100) NULL,
    extracted_entities JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL,
    INDEX idx_ai_generated (ai_generated),
    INDEX idx_confidence_score (confidence_score)
) ENGINE=InnoDB;

-- ================================================================
-- AI ESCALATION HISTORY TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_escalation_history (
    id VARCHAR(36) PRIMARY KEY,
    ticket_id INT NOT NULL,
    action_type ENUM('passed', 'canceled', 'reassigned') NOT NULL,
    performed_by INT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    previous_assignee INT NULL,
    new_assignee INT NULL,
    escalation_level INT DEFAULT 1,
    resolution_notes TEXT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (previous_assignee) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (new_assignee) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_action_type (action_type),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ================================================================
-- AI FEEDBACK COLLECTION TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_feedback (
    id VARCHAR(36) PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL,
    message_id VARCHAR(36) NULL,
    user_id INT NOT NULL,
    feedback_type ENUM('solution_rating', 'general_feedback', 'bug_report', 'feature_request') NOT NULL,
    rating INT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT NULL,
    was_helpful BOOLEAN NULL,
    improvement_suggestions TEXT NULL,
    follow_up_requested BOOLEAN DEFAULT FALSE,
    ticket_created_from_feedback BOOLEAN DEFAULT FALSE,
    created_ticket_id INT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_rating (rating),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ================================================================
-- AI LEARNING PATTERNS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
    id VARCHAR(36) PRIMARY KEY,
    pattern_type ENUM('successful_resolution', 'failed_resolution', 'user_preference', 'common_issue') NOT NULL,
    pattern_data JSON NOT NULL,
    frequency_count INT DEFAULT 1,
    confidence_level DECIMAL(3,2) DEFAULT 0.50,
    last_observed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_observed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_score DECIMAL(3,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pattern_type (pattern_type),
    INDEX idx_frequency_count (frequency_count),
    INDEX idx_confidence_level (confidence_level),
    INDEX idx_last_observed (last_observed)
) ENGINE=InnoDB;

-- ================================================================
-- AI NOTIFICATION ENHANCEMENTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS ai_notification_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    channel_type ENUM('in_app', 'email', 'sms', 'push', 'webhook') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status ENUM('pending', 'sent', 'delivered', 'failed', 'bounced') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    error_message TEXT NULL,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    INDEX idx_notification_id (notification_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB;

-- ================================================================
-- VIEWS FOR AI ANALYTICS
-- ================================================================

-- AI Performance Summary View
CREATE OR REPLACE VIEW v_ai_performance_summary AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_queries,
    SUM(CASE WHEN classification_result = 'auto_resolvable' THEN 1 ELSE 0 END) as auto_resolvable_count,
    SUM(CASE WHEN resolution_type = 'auto_resolved' THEN 1 ELSE 0 END) as auto_resolved_count,
    SUM(CASE WHEN resolution_type = 'ticket_created' THEN 1 ELSE 0 END) as tickets_created_count,
    AVG(confidence_score) as avg_confidence,
    AVG(CASE WHEN user_satisfaction IS NOT NULL THEN user_satisfaction END) as avg_satisfaction,
    AVG(processing_time_ms) as avg_processing_time
FROM ai_query_metrics
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Active AI Conversations View
CREATE OR REPLACE VIEW v_active_ai_conversations AS
SELECT 
    c.id,
    c.user_id,
    u.username,
    c.session_id,
    c.started_at,
    c.total_messages,
    c.is_active,
    TIMESTAMPDIFF(MINUTE, c.started_at, NOW()) as duration_minutes
FROM ai_conversations c
JOIN users u ON c.user_id = u.id
WHERE c.is_active = TRUE
ORDER BY c.started_at DESC;

-- Knowledge Base Usage Statistics View
CREATE OR REPLACE VIEW v_knowledge_base_stats AS
SELECT 
    category,
    COUNT(*) as total_entries,
    AVG(success_rate) as avg_success_rate,
    SUM(usage_count) as total_usage,
    MAX(last_updated) as last_updated
FROM ai_knowledge_entries
WHERE is_active = TRUE
GROUP BY category
ORDER BY total_usage DESC;

-- ================================================================
-- INSERT SAMPLE AI DATA
-- ================================================================

-- Insert sample AI knowledge entries
INSERT INTO ai_knowledge_entries (id, title, content, category, tags, difficulty, success_rate, created_by) VALUES
(UUID(), 'Password Reset Process', 'To reset your password: 1) Go to login page 2) Click "Forgot Password" 3) Enter your email 4) Check your email for reset link 5) Follow the link and create a new password', 'account', '["password", "reset", "login", "security"]', 'beginner', 95.50, 'human'),
(UUID(), 'Account Registration Guide', 'Creating a new account: 1) Click "Register" on login page 2) Fill in username, email, and password 3) Verify email address 4) Complete profile setup', 'account', '["registration", "signup", "account", "new user"]', 'beginner', 98.20, 'human'),
(UUID(), 'Billing and Payment Issues', 'For billing inquiries: 1) Check account dashboard billing section 2) View invoices and payment history 3) Update payment methods 4) Contact billing support for disputes', 'billing', '["billing", "payment", "invoice", "subscription"]', 'intermediate', 87.30, 'human'),
(UUID(), 'Technical Error Troubleshooting', 'When encountering errors: 1) Note the exact error message 2) Check browser console for details 3) Try clearing cache and cookies 4) Disable browser extensions 5) Try different browser', 'technical', '["error", "troubleshooting", "bug", "technical"]', 'advanced', 76.80, 'human'),
(UUID(), 'API Integration Help', 'API integration steps: 1) Obtain API key from dashboard 2) Review API documentation 3) Test endpoints with provided examples 4) Implement authentication 5) Handle rate limiting', 'technical', '["api", "integration", "development", "authentication"]', 'advanced', 82.10, 'human');

-- Insert sample solution patterns
INSERT INTO ai_solution_patterns (id, query_pattern, solution_template, pattern_variables, success_count, confidence_threshold) VALUES
(UUID(), 'password.*reset|forgot.*password|can.*login', 'I can help you reset your password. Please follow these steps: {password_reset_steps}. If you continue to have issues, I can create a support ticket for you.', '{"password_reset_steps": "1) Go to the login page 2) Click Forgot Password 3) Enter your email 4) Check for reset email"}', 45, 0.85),
(UUID(), 'account.*create|sign.*up|register|new.*account', 'To create a new account: {registration_steps}. Would you like me to guide you through the process?', '{"registration_steps": "1) Click Register 2) Fill in your details 3) Verify your email 4) Complete setup"}', 38, 0.90),
(UUID(), 'billing|payment|invoice|subscription', 'For billing-related questions: {billing_help}. You can also access your billing information in your account dashboard.', '{"billing_help": "1) Check your account dashboard 2) View payment history 3) Update payment methods 4) Download invoices"}', 29, 0.80),
(UUID(), 'error|bug|not.*working|broken|crash', 'I understand you are experiencing a technical issue. To help resolve this: {troubleshooting_steps}. If these steps do not help, I will create a support ticket for our technical team.', '{"troubleshooting_steps": "1) Please describe the exact error 2) What were you trying to do? 3) What browser are you using? 4) Try refreshing the page"}', 52, 0.75);

-- Initialize AI system performance for today
INSERT INTO ai_system_performance (date, total_queries, auto_resolved_queries, tickets_created, average_confidence, classification_accuracy) 
VALUES (CURDATE(), 0, 0, 0, 0.00, 0.00)
ON DUPLICATE KEY UPDATE date = date;

SELECT 'AI Assistant database schema created successfully!' as status;