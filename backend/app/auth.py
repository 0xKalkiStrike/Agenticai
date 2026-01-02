"""
Authentication Service Module
Handles JWT token operations
"""

import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import HTTPException, Header

class AuthService:
    """Authentication service for JWT operations"""
    
    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.token_expire_minutes = 60
    
    def create_token(self, user_id: int, username: str, role: str) -> str:
        """Create JWT token"""
        payload = {
            "id": user_id,
            "username": username,
            "role": role,
            "exp": datetime.utcnow() + timedelta(minutes=self.token_expire_minutes),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> Optional[Dict]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def get_user_role(self, token: str) -> Optional[str]:
        """Get user role from token"""
        payload = self.verify_token(token)
        return payload.get("role") if payload else None
    
    def get_user_id(self, token: str) -> Optional[int]:
        """Get user ID from token"""
        payload = self.verify_token(token)
        return payload.get("id") if payload else None
    
    def is_token_valid(self, token: str) -> bool:
        """Check if token is valid"""
        return self.verify_token(token) is not None
    
    def refresh_token(self, token: str) -> Optional[str]:
        """Refresh an existing token"""
        payload = self.verify_token(token)
        if not payload:
            return None
        
        return self.create_token(
            payload["id"],
            payload["username"],
            payload["role"]
        )

# Global auth service instance (will be initialized in main.py)
auth_service = None

def get_current_user(authorization: str = Header(None)):
    """Get current user from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]
    
    # Use global auth service
    if not auth_service:
        raise HTTPException(status_code=500, detail="Auth service not initialized")
    
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload
