#!/usr/bin/env python3
"""
Quick test script to check if there are tickets in the database
and create some sample tickets if needed.
"""

import requests
import json

API_BASE = "http://127.0.0.1:8000"

def test_health():
    """Test if backend is running"""
    try:
        response = requests.get(f"{API_BASE}/health")
        print(f"Health check: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def login_as_client():
    """Login as a client to get auth token"""
    try:
        # Try to login as a client (assuming there's a client user)
        response = requests.post(f"{API_BASE}/login", json={
            "username": "client1",  # Common test username
            "password": "password123"
        })
        
        if response.status_code == 200:
            data = response.json()
            print(f"Login successful: {data}")
            return data.get('token')
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def check_all_tickets():
    """Check if there are any tickets in the system"""
    try:
        # Try without auth first
        response = requests.get(f"{API_BASE}/admin/tickets/all")
        print(f"All tickets check: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            tickets = data.get('tickets', [])
            print(f"Found {len(tickets)} tickets in system")
            return tickets
        else:
            print(f"Failed to get tickets: {response.text}")
            return []
    except Exception as e:
        print(f"Error checking tickets: {e}")
        return []

def create_sample_tickets(auth_token):
    """Create some sample tickets for testing"""
    if not auth_token:
        print("No auth token, cannot create tickets")
        return False
    
    sample_tickets = [
        {"query": "Login page is not loading properly", "priority": "HIGH"},
        {"query": "Dashboard shows incorrect data", "priority": "MEDIUM"},
        {"query": "Email notifications not working", "priority": "LOW"},
        {"query": "API response is slow", "priority": "MEDIUM"},
        {"query": "User registration form has validation errors", "priority": "HIGH"}
    ]
    
    headers = {"Authorization": f"Bearer {auth_token}"}
    created_count = 0
    
    for ticket_data in sample_tickets:
        try:
            response = requests.post(
                f"{API_BASE}/client/tickets/create",
                json=ticket_data,
                headers=headers
            )
            
            if response.status_code == 200:
                created_count += 1
                print(f"Created ticket: {ticket_data['query'][:50]}...")
            else:
                print(f"Failed to create ticket: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Error creating ticket: {e}")
    
    print(f"Created {created_count} sample tickets")
    return created_count > 0

def main():
    print("=== Testing Ticket API ===")
    
    # Test backend health
    if not test_health():
        print("Backend is not running!")
        return
    
    # Check existing tickets
    tickets = check_all_tickets()
    
    if len(tickets) == 0:
        print("\nNo tickets found. Creating sample tickets...")
        
        # Login as client to create tickets
        token = login_as_client()
        if token:
            create_sample_tickets(token)
            
            # Check again
            print("\nRechecking tickets after creation...")
            tickets = check_all_tickets()
        else:
            print("Could not login to create sample tickets")
    
    print(f"\nFinal ticket count: {len(tickets)}")

if __name__ == "__main__":
    main()