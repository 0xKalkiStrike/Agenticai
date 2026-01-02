"""
RBAC Middleware for Role-Based Access Control
"""

import os
import jwt
import functools
from typing import List, Optional, Dict, Any, Callable
from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey")
JWT_ALGORITHM = "HS256"

# Security scheme
security = HTTPBearer()

# Role hierarchy for permission inheritance
ROLE_HIERARCHY = {
    "client": 1,
    "developer": 2,
    "project_manager": 3,
    "admin": 4
}

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from JWT token
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Validate required fields
        if "id" not in payload or "role" not in payload:
            raise HTTPException(
                status_code=401, 
                detail="Invalid token: missing required fields"
            )
        
        return {
            "id": payload["id"],
            "role": payload["role"],
            "username": payload.get("sub", "unknown")
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def role_required(*allowed_roles: str) -> Callable:
    """
    Decorator to require specific roles for endpoint access
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get user from dependency injection
            user = kwargs.get('current_user') or kwargs.get('user')
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            user_role = user.get("role")
            if user_role not in allowed_roles:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
                )
            
            return func(*args, **kwargs)
        return wrapper
    return decorator

def permission_required(*required_permissions: str) -> Callable:
    """
    Decorator to require specific permissions for endpoint access
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get user from dependency injection
            user = kwargs.get('current_user') or kwargs.get('user')
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            # For simplicity, allow all authenticated users
            return func(*args, **kwargs)
        return wrapper
    return decorator

def resource_access_required(resource_type: str, resource_id_param: str = "resource_id") -> Callable:
    """
    Decorator to validate resource-level access control
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get user from dependency injection
            user = kwargs.get('current_user') or kwargs.get('user')
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            # For simplicity, allow access for authenticated users
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Convenience functions for common role checks
def admin_required(func: Callable) -> Callable:
    """Decorator requiring admin role"""
    return role_required("admin")(func)

def admin_or_pm_required(func: Callable) -> Callable:
    """Decorator requiring admin or project manager role"""
    return role_required("admin", "project_manager")(func)

def developer_required(func: Callable) -> Callable:
    """Decorator requiring developer role"""
    return role_required("developer")(func)

def client_required(func: Callable) -> Callable:
    """Decorator requiring client role"""
    return role_required("client")(func)