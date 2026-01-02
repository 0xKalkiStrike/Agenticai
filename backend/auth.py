import os
import jwt
from datetime import datetime, timedelta

import os
print("JWT_SECRET =", os.getenv("JWT_SECRET"))

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MIN = 60

def create_token(username: str, role: str):
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
def get_user_role(token: str):
    decoded = verify_token(token)
    return decoded.get("role")
def is_admin(token: str):
    role = get_user_role(token)
    return role == "admin"
def is_user(token: str):
    role = get_user_role(token)
    return role == "user"
def is_guest(token: str):
    role = get_user_role(token)
    return role == "guest"
def has_permission(token: str, required_role: str):
    role = get_user_role(token)
    roles_hierarchy = {"guest": 1, "user": 2, "admin": 3}
    return roles_hierarchy.get(role, 0) >= roles_hierarchy.get(required_role, 0)
def refresh_token(token: str):
    decoded = verify_token(token)
    username = decoded.get("sub")
    role = decoded.get("role")
    return create_token(username, role)
def revoke_token(token: str):
    # In a real application, you would store revoked tokens in a database or cache
    # Here we just simulate revocation by returning None
    return None
def get_username(token: str):
    decoded = verify_token(token)
    return decoded.get("sub")
def token_is_expired(token: str):
    try:
        verify_token(token)
        return False
    except jwt.ExpiredSignatureError:
        return True
def get_token_expiration(token: str):
    decoded = verify_token(token)
    exp_timestamp = decoded.get("exp")
    return datetime.utcfromtimestamp(exp_timestamp)
def change_user_role(token: str, new_role: str):
    decoded = verify_token(token)
    username = decoded.get("sub")
    return create_token(username, new_role)
def get_all_roles():
    return ["guest", "user", "admin"]
def token_payload(token: str):
    return verify_token(token)
def is_token_valid(token: str):
    try:
        verify_token(token)
        return True
    except jwt.InvalidTokenError:
        return False
def get_token_issued_at(token: str):
    decoded = verify_token(token)
    iat_timestamp = decoded.get("iat")
    return datetime.utcfromtimestamp(iat_timestamp)
def create_token_with_custom_expiry(username: str, role: str, minutes: int):
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=minutes)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def get_token_audience(token: str):
    decoded = verify_token(token)
    return decoded.get("aud")
def get_token_issuer(token: str):
    decoded = verify_token(token)
    return decoded.get("iss")
def create_token_with_audience(username: str, role: str, audience: str):
    payload = {
        "sub": username,
        "role": role,
        "aud": audience,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def create_token_with_issuer(username: str, role: str, issuer: str):
    payload = {
        "sub": username,
        "role": role,
        "iss": issuer,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_audience(token: str, audience: str):
    decoded = verify_token(token)
    return decoded.get("aud") == audience
def validate_token_issuer(token: str, issuer: str):
    decoded = verify_token(token)
    return decoded.get("iss") == issuer
def get_token_scopes(token: str):
    decoded = verify_token(token)
    return decoded.get("scopes", [])
def create_token_with_scopes(username: str, role: str, scopes: list):
    payload = {
        "sub": username,
        "role": role,
        "scopes": scopes,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_scopes(token: str, required_scopes: list):
    token_scopes = get_token_scopes(token)
    return all(scope in token_scopes for scope in required_scopes)
def get_token_jti(token: str):
    decoded = verify_token(token)
    return decoded.get("jti")
def create_token_with_jti(username: str, role: str, jti: str):
    payload = {
        "sub": username,
        "role": role,
        "jti": jti,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_jti(token: str, jti: str):
    decoded = verify_token(token)
    return decoded.get("jti") == jti
def get_token_not_before(token: str):
    decoded = verify_token(token)
    nbf_timestamp = decoded.get("nbf")
    return datetime.utcfromtimestamp(nbf_timestamp)
def create_token_with_not_before(username: str, role: str, not_before_minutes: int):
    payload = {
        "sub": username,
        "role": role,
        "nbf": datetime.utcnow() + timedelta(minutes=not_before_minutes),
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_not_before(token: str):
    decoded = verify_token(token)
    nbf_timestamp = decoded.get("nbf")
    if nbf_timestamp:
        nbf_time = datetime.utcfromtimestamp(nbf_timestamp)
        return datetime.utcnow() >= nbf_time
    return True
def get_token_subject(token: str):
    decoded = verify_token(token)
    return decoded.get("sub")
def create_token_with_subject(username: str, role: str, subject: str):
    payload = {
        "sub": subject,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_subject(token: str, subject: str):
    decoded = verify_token(token)
    return decoded.get("sub") == subject
def get_token_issued_by(token: str):
    decoded = verify_token(token)
    return decoded.get("iss")
def create_token_issued_by(username: str, role: str, issuer: str):
    payload = {
        "sub": username,
        "role": role,
        "iss": issuer,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_issued_by(token: str, issuer: str):
    decoded = verify_token(token)
    return decoded.get("iss") == issuer
def get_token_audience_list(token: str):
    decoded = verify_token(token)
    audience = decoded.get("aud")
    if isinstance(audience, list):
        return audience
    elif audience:
        return [audience]
    return []
def create_token_with_audience_list(username: str, role: str, audience: list):
    payload = {
        "sub": username,
        "role": role,
        "aud": audience,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_audience_list(token: str, audience: list):
    decoded = verify_token(token)
    token_audience = decoded.get("aud")
    if isinstance(token_audience, list):
        return all(aud in token_audience for aud in audience)
    elif token_audience:
        return token_audience in audience
    return False
def get_token_custom_claim(token: str, claim: str):
    decoded = verify_token(token)
    return decoded.get(claim)
def create_token_with_custom_claim(username: str, role: str, claim: str, value):
    payload = {
        "sub": username,
        "role": role,
        claim: value,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_custom_claim(token: str, claim: str, value):
    decoded = verify_token(token)
    return decoded.get(claim) == value
def get_token_all_claims(token: str):
    return verify_token(token)
def create_token_with_all_claims(username: str, role: str, claims: dict):
    payload = {
        "sub": username,
        "role": role,
        **claims,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_all_claims(token: str, claims: dict):
    decoded = verify_token(token)
    for claim, value in claims.items():
        if decoded.get(claim) != value:
            return False
    return True
import os
import jwt
from datetime import datetime, timedelta

import os
print("JWT_SECRET =", os.getenv("JWT_SECRET"))

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MIN = 60

def create_token(username: str, role: str):
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
def get_user_role(token: str):
    decoded = verify_token(token)
    return decoded.get("role")
def is_admin(token: str):
    role = get_user_role(token)
    return role == "admin"
def is_user(token: str):
    role = get_user_role(token)
    return role == "user"
def is_guest(token: str):
    role = get_user_role(token)
    return role == "guest"
def has_permission(token: str, required_role: str):
    role = get_user_role(token)
    roles_hierarchy = {"guest": 1, "user": 2, "admin": 3}
    return roles_hierarchy.get(role, 0) >= roles_hierarchy.get(required_role, 0)
def refresh_token(token: str):
    decoded = verify_token(token)
    username = decoded.get("sub")
    role = decoded.get("role")
    return create_token(username, role)
def revoke_token(token: str):
    # In a real application, you would store revoked tokens in a database or cache
    # Here we just simulate revocation by returning None
    return None
def get_username(token: str):
    decoded = verify_token(token)
    return decoded.get("sub")
def token_is_expired(token: str):
    try:
        verify_token(token)
        return False
    except jwt.ExpiredSignatureError:
        return True
def get_token_expiration(token: str):
    decoded = verify_token(token)
    exp_timestamp = decoded.get("exp")
    return datetime.utcfromtimestamp(exp_timestamp)
def change_user_role(token: str, new_role: str):
    decoded = verify_token(token)
    username = decoded.get("sub")
    return create_token(username, new_role)
def get_all_roles():
    return ["guest", "user", "admin"]
def token_payload(token: str):
    return verify_token(token)
def is_token_valid(token: str):
    try:
        verify_token(token)
        return True
    except jwt.InvalidTokenError:
        return False
def get_token_issued_at(token: str):
    decoded = verify_token(token)
    iat_timestamp = decoded.get("iat")
    return datetime.utcfromtimestamp(iat_timestamp)
def create_token_with_custom_expiry(username: str, role: str, minutes: int):
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=minutes)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def get_token_audience(token: str):
    decoded = verify_token(token)
    return decoded.get("aud")
def get_token_issuer(token: str):
    decoded = verify_token(token)
    return decoded.get("iss")
def create_token_with_audience(username: str, role: str, audience: str):
    payload = {
        "sub": username,
        "role": role,
        "aud": audience,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def create_token_with_issuer(username: str, role: str, issuer: str):
    payload = {
        "sub": username,
        "role": role,
        "iss": issuer,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_audience(token: str, audience: str):
    decoded = verify_token(token)
    return decoded.get("aud") == audience
def validate_token_issuer(token: str, issuer: str):
    decoded = verify_token(token)
    return decoded.get("iss") == issuer
def get_token_scopes(token: str):
    decoded = verify_token(token)
    return decoded.get("scopes", [])
def create_token_with_scopes(username: str, role: str, scopes: list):
    payload = {
        "sub": username,
        "role": role,
        "scopes": scopes,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_scopes(token: str, required_scopes: list):
    token_scopes = get_token_scopes(token)
    return all(scope in token_scopes for scope in required_scopes)
def get_token_jti(token: str):
    decoded = verify_token(token)
    return decoded.get("jti")
def create_token_with_jti(username: str, role: str, jti: str):
    payload = {
        "sub": username,
        "role": role,
        "jti": jti,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_jti(token: str, jti: str):
    decoded = verify_token(token)
    return decoded.get("jti") == jti
def get_token_not_before(token: str):
    decoded = verify_token(token)
    nbf_timestamp = decoded.get("nbf")
    return datetime.utcfromtimestamp(nbf_timestamp)
def create_token_with_not_before(username: str, role: str, not_before_minutes: int):
    payload = {
        "sub": username,
        "role": role,
        "nbf": datetime.utcnow() + timedelta(minutes=not_before_minutes),
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_not_before(token: str):
    decoded = verify_token(token)
    nbf_timestamp = decoded.get("nbf")
    if nbf_timestamp:
        nbf_time = datetime.utcfromtimestamp(nbf_timestamp)
        return datetime.utcnow() >= nbf_time
    return True
def get_token_subject(token: str):
    decoded = verify_token(token)
    return decoded.get("sub")
def create_token_with_subject(username: str, role: str, subject: str):
    payload = {
        "sub": subject,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_subject(token: str, subject: str):
    decoded = verify_token(token)
    return decoded.get("sub") == subject
def get_token_issued_by(token: str):
    decoded = verify_token(token)
    return decoded.get("iss")
def create_token_issued_by(username: str, role: str, issuer: str):
    payload = {
        "sub": username,
        "role": role,
        "iss": issuer,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_issued_by(token: str, issuer: str):
    decoded = verify_token(token)
    return decoded.get("iss") == issuer
def get_token_audience_list(token: str):
    decoded = verify_token(token)
    audience = decoded.get("aud")
    if isinstance(audience, list):
        return audience
    elif audience:
        return [audience]
    return []
def create_token_with_audience_list(username: str, role: str, audience: list):
    payload = {
        "sub": username,
        "role": role,
        "aud": audience,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_audience_list(token: str, audience: list):
    decoded = verify_token(token)
    token_audience = decoded.get("aud")
    if isinstance(token_audience, list):
        return all(aud in token_audience for aud in audience)
    elif token_audience:
        return token_audience in audience
    return False
def get_token_custom_claim(token: str, claim: str):
    decoded = verify_token(token)
    return decoded.get(claim)
def create_token_with_custom_claim(username: str, role: str, claim: str, value):
    payload = {
        "sub": username,
        "role": role,
        claim: value,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_custom_claim(token: str, claim: str, value):
    decoded = verify_token(token)
    return decoded.get(claim) == value
def get_token_all_claims(token: str):
    return verify_token(token)
def create_token_with_all_claims(username: str, role: str, claims: dict):
    payload = {
        "sub": username,
        "role": role,
        **claims,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
def validate_token_all_claims(token: str, claims: dict):
    decoded = verify_token(token)
    for claim, value in claims.items():
        if decoded.get(claim) != value:
            return False
    return True
