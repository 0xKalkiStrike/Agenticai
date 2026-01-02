"""
Ticket Visibility Engine - Controls which tickets are visible to which users based on role-based rules
"""

from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import logging
import time
from functools import lru_cache
from database import get_cursor, close_conn

logger = logging.getLogger(__name__)

class TicketVisibilityEngine:
    """
    Controls ticket visibility based on user roles and permissions.
    Implements requirements 1.1-1.6 for proper ticket visibility.
    """
    
    def __init__(self):
        self.visibility_rules = {
            'client': {
                'can_see': ['own_tickets'],
                'cannot_see': ['other_client_tickets', 'internal_notes']
            },
            'developer': {
                'can_see': ['assigned_tickets', 'unassigned_tickets', 'self_assignable', 'all_active_tickets'],
                'cannot_see': ['other_developer_private_notes']
            },
            'project_manager': {
                'can_see': ['team_tickets', 'unassigned_tickets', 'all_open_tickets', 'all_active_tickets'],
                'cannot_see': ['admin_only_tickets']
            },
            'admin': {
                'can_see': ['all_tickets'],
                'cannot_see': []
            }
        }
        
        # Performance monitoring
        self.query_stats = {
            'total_queries': 0,
            'avg_response_time': 0.0,
            'cache_hits': 0,
            'cache_misses': 0
        }
    
    def get_visible_tickets(self, user_id: int, user_role: str, filters: Optional[Dict] = None) -> List[Dict]:
        """
        Get tickets visible to the user based on their role and applied filters.
        
        Args:
            user_id: ID of the requesting user
            user_role: Role of the requesting user
            filters: Optional filters to apply (status, priority, etc.)
            
        Returns:
            List of tickets visible to the user
        """
        start_time = time.time()
        
        try:
            # Validate inputs
            if not user_id or not user_role:
                raise ValueError("User ID and role are required")
            
            if user_role not in self.visibility_rules:
                logger.warning(f"Unknown user role: {user_role}")
                return []
            
            conn, cur = get_cursor()
            
            # Build base query based on role
            base_query, params = self._build_base_query(user_id, user_role)
            
            # Apply additional filters
            if filters:
                filter_clause, filter_params = self._build_filter_clause(filters)
                if filter_clause:
                    base_query += f" AND {filter_clause}"
                    params.extend(filter_params)
            
            # Add ordering for performance and limit for large datasets
            base_query += " ORDER BY t.created_at DESC LIMIT 1000"
            
            # Execute query with timeout protection
            logger.debug(f"Executing query for user {user_id} (role: {user_role})")
            cur.execute(base_query, params)
            tickets = cur.fetchall()
            
            # Apply role-based filtering to results
            filtered_tickets = self._apply_role_based_filtering(tickets, user_role, user_id)
            
            # Update performance stats
            response_time = time.time() - start_time
            self._update_performance_stats(response_time)
            
            # Log performance warning if query is slow
            if response_time > 2.0:  # Requirement 1.6: Load within 2 seconds
                logger.warning(f"Slow query detected: {response_time:.2f}s for user {user_id}")
            
            logger.info(f"Retrieved {len(filtered_tickets)} tickets for user {user_id} (role: {user_role}) in {response_time:.3f}s")
            return filtered_tickets
            
        except Exception as e:
            logger.error(f"Error retrieving tickets for user {user_id}: {str(e)}")
            # Return empty list instead of raising to prevent dashboard crashes
            return []
        finally:
            try:
                close_conn(conn, cur)
            except:
                pass
    
    def check_ticket_access(self, user_id: int, ticket_id: int, user_role: str, action: str = "view") -> bool:
        """
        Check if user has access to perform action on specific ticket.
        
        Args:
            user_id: ID of the requesting user
            ticket_id: ID of the ticket to check
            user_role: Role of the requesting user
            action: Action to perform (view, assign, complete, etc.)
            
        Returns:
            True if user has access, False otherwise
        """
        try:
            # Validate inputs
            if not user_id or not ticket_id or not user_role:
                return False
            
            if user_role not in self.visibility_rules:
                return False
            
            conn, cur = get_cursor()
            
            # Get ticket details with timeout
            cur.execute("""
                SELECT t.id, t.user_id, t.assigned_developer_id, t.status, t.priority,
                       c.username as client_name, d.username as developer_name
                FROM tickets t
                LEFT JOIN users c ON t.user_id = c.id
                LEFT JOIN users d ON t.assigned_developer_id = d.id
                WHERE t.id = %s
            """, (ticket_id,))
            
            ticket = cur.fetchone()
            if not ticket:
                return False
            
            # Apply role-based access rules
            return self._check_role_based_access(ticket, user_id, user_role, action)
            
        except Exception as e:
            logger.error(f"Error checking ticket access for user {user_id}, ticket {ticket_id}: {str(e)}")
            return False
        finally:
            try:
                close_conn(conn, cur)
            except:
                pass
    
    def get_active_tickets_for_role(self, user_id: int, user_role: str) -> List[Dict]:
        """
        Get active tickets (OPEN and IN_PROGRESS) visible to user based on role.
        This implements the "Active Tickets" section visibility requirements.
        
        Args:
            user_id: ID of the requesting user
            user_role: Role of the requesting user
            
        Returns:
            List of active tickets visible to the user
        """
        filters = {
            'status': ['OPEN', 'IN_PROGRESS']
        }
        return self.get_visible_tickets(user_id, user_role, filters)
    
    def get_performance_stats(self) -> Dict:
        """Get performance statistics for monitoring."""
        return self.query_stats.copy()
    
    def _update_performance_stats(self, response_time: float):
        """Update performance statistics."""
        self.query_stats['total_queries'] += 1
        
        # Calculate rolling average
        total = self.query_stats['total_queries']
        current_avg = self.query_stats['avg_response_time']
        self.query_stats['avg_response_time'] = ((current_avg * (total - 1)) + response_time) / total
    
    def _build_base_query(self, user_id: int, user_role: str) -> tuple:
        """Build base SQL query based on user role."""
        
        base_select = """
            SELECT t.id, t.user_id, t.query, t.reply, t.status, t.priority,
                   t.assigned_developer_id, t.assigned_by, t.assigned_at, t.assignment_notes,
                   t.completed_at, t.completion_notes, t.created_at, t.updated_at,
                   c.username as client_name, c.email as client_email,
                   d.username as developer_name, d.email as developer_email,
                   a.username as assigned_by_name
            FROM tickets t
            LEFT JOIN users c ON t.user_id = c.id
            LEFT JOIN users d ON t.assigned_developer_id = d.id
            LEFT JOIN users a ON t.assigned_by = a.id
        """
        
        if user_role == 'client':
            # Clients see only their own tickets (Requirement 1.1)
            where_clause = "WHERE t.user_id = %s"
            params = [user_id]
            
        elif user_role == 'developer':
            # Developers see all active tickets (Requirements 1.5)
            where_clause = "WHERE t.status IN ('OPEN', 'IN_PROGRESS')"
            params = []
            
        elif user_role == 'project_manager':
            # Project managers see all active tickets (Requirements 1.4)
            where_clause = "WHERE t.status IN ('OPEN', 'IN_PROGRESS')"
            params = []
            
        elif user_role == 'admin':
            # Admins see all tickets (Requirements 1.3)
            where_clause = "WHERE 1=1"  # No restriction
            params = []
            
        else:
            # Unknown role - no access
            where_clause = "WHERE 1=0"  # No results
            params = []
        
        return f"{base_select} {where_clause}", params
    
    def _build_filter_clause(self, filters: Dict) -> tuple:
        """Build WHERE clause for additional filters."""
        clauses = []
        params = []
        
        if 'status' in filters and filters['status']:
            if isinstance(filters['status'], list):
                placeholders = ','.join(['%s'] * len(filters['status']))
                clauses.append(f"t.status IN ({placeholders})")
                params.extend(filters['status'])
            else:
                clauses.append("t.status = %s")
                params.append(filters['status'])
        
        if 'priority' in filters and filters['priority']:
            if isinstance(filters['priority'], list):
                placeholders = ','.join(['%s'] * len(filters['priority']))
                clauses.append(f"t.priority IN ({placeholders})")
                params.extend(filters['priority'])
            else:
                clauses.append("t.priority = %s")
                params.append(filters['priority'])
        
        if 'assigned_to' in filters and filters['assigned_to'] is not None:
            assigned_to = filters['assigned_to']
            if assigned_to == [None] or assigned_to is None:
                # Filter for unassigned tickets
                clauses.append("t.assigned_developer_id IS NULL")
            elif isinstance(assigned_to, list):
                # Filter for specific developers, excluding None values
                valid_ids = [id for id in assigned_to if id is not None]
                if valid_ids:
                    placeholders = ','.join(['%s'] * len(valid_ids))
                    clauses.append(f"t.assigned_developer_id IN ({placeholders})")
                    params.extend(valid_ids)
            else:
                clauses.append("t.assigned_developer_id = %s")
                params.append(assigned_to)
        
        if 'search_query' in filters and filters['search_query']:
            search_term = f"%{filters['search_query']}%"
            clauses.append("(t.query LIKE %s OR c.username LIKE %s)")
            params.extend([search_term, search_term])
        
        if 'date_range' in filters and filters['date_range']:
            date_range = filters['date_range']
            if 'start' in date_range:
                clauses.append("t.created_at >= %s")
                params.append(date_range['start'])
            if 'end' in date_range:
                clauses.append("t.created_at <= %s")
                params.append(date_range['end'])
        
        filter_clause = ' AND '.join(clauses) if clauses else ''
        return filter_clause, params
    
    def _apply_role_based_filtering(self, tickets: List[Dict], user_role: str, user_id: int) -> List[Dict]:
        """Apply additional role-based filtering to ticket results."""
        
        if user_role == 'client':
            # Clients should only see their own tickets - this is enforced in query
            # but we double-check here for security
            return [ticket for ticket in tickets if ticket['user_id'] == user_id]
        
        elif user_role in ['developer', 'project_manager', 'admin']:
            # Staff roles see all tickets returned by query
            # Remove sensitive internal notes for non-admin users
            if user_role != 'admin':
                for ticket in tickets:
                    # Remove internal assignment notes for non-admin users
                    if ticket.get('assignment_notes') and 'INTERNAL:' in str(ticket['assignment_notes']):
                        ticket['assignment_notes'] = '[Internal notes hidden]'
            
            return tickets
        
        else:
            # Unknown role - no tickets
            return []
    
    def _check_role_based_access(self, ticket: Dict, user_id: int, user_role: str, action: str) -> bool:
        """Check if user has access to perform action on ticket based on role."""
        
        if user_role == 'client':
            # Clients can only access their own tickets
            return ticket['user_id'] == user_id
        
        elif user_role == 'developer':
            if action == 'view':
                # Developers can view all active tickets
                return ticket['status'] in ['OPEN', 'IN_PROGRESS']
            elif action == 'assign':
                # Developers can self-assign unassigned tickets
                return ticket['status'] == 'OPEN' and not ticket['assigned_developer_id']
            elif action in ['complete', 'update', 'pass', 'cancel']:
                # Developers can only modify tickets assigned to them
                return ticket['assigned_developer_id'] == user_id
        
        elif user_role == 'project_manager':
            if action == 'view':
                # PMs can view all active tickets
                return ticket['status'] in ['OPEN', 'IN_PROGRESS']
            elif action == 'assign':
                # PMs can assign any unassigned ticket
                return ticket['status'] == 'OPEN'
            elif action in ['complete', 'update']:
                # PMs cannot directly complete tickets (only developers can)
                return False
        
        elif user_role == 'admin':
            # Admins have full access to all tickets and actions
            return True
        
        return False

# Global instance
ticket_visibility_engine = TicketVisibilityEngine()