#!/usr/bin/env python3
"""
Test script for User Management Actions API endpoints
Tests the activation and deactivation functionality
"""

import requests
import json
import sys

API_BASE_URL = "http://127.0.0.1:8000"

def test_login_as_admin():
    """Login as admin to get authentication token"""
    print("🔐 Testing admin login...")
    
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    response = requests.post(f"{API_BASE_URL}/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Login successful! Role: {data['role']}")
        return data['token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_get_users(token):
    """Get all users to find a test user"""
    print("\n👥 Getting all users...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE_URL}/admin/users/all", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        users = data.get('users', [])
        print(f"✅ Found {len(users)} users")
        
        # Find a non-admin user for testing
        test_user = None
        for user in users:
            if user['role'] != 'admin':
                test_user = user
                break
        
        if test_user:
            print(f"🎯 Test user: {test_user['username']} (ID: {test_user['id']}, Active: {test_user['is_active']})")
            return test_user
        else:
            print("⚠️ No non-admin users found for testing")
            return None
    else:
        print(f"❌ Failed to get users: {response.status_code} - {response.text}")
        return None

def test_user_activation(token, user_id, username):
    """Test user activation endpoint"""
    print(f"\n🟢 Testing user activation for {username} (ID: {user_id})...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_BASE_URL}/admin/users/{user_id}/activate", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Activation successful: {data['message']}")
        print(f"   User active status: {data['user']['isActive']}")
        return True
    else:
        print(f"❌ Activation failed: {response.status_code} - {response.text}")
        return False

def test_user_deactivation(token, user_id, username):
    """Test user deactivation endpoint"""
    print(f"\n🔴 Testing user deactivation for {username} (ID: {user_id})...")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_BASE_URL}/admin/users/{user_id}/deactivate", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Deactivation successful: {data['message']}")
        print(f"   User active status: {data['user']['isActive']}")
        return True
    else:
        print(f"❌ Deactivation failed: {response.status_code} - {response.text}")
        return False

def test_self_deactivation_prevention(token):
    """Test that admin cannot deactivate themselves"""
    print(f"\n🛡️ Testing self-deactivation prevention...")
    
    # First get admin user ID
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE_URL}/admin/users/all", headers=headers)
    
    if response.status_code != 200:
        print("❌ Failed to get users for self-deactivation test")
        return False
    
    users = response.json().get('users', [])
    admin_user = None
    for user in users:
        if user['role'] == 'admin':
            admin_user = user
            break
    
    if not admin_user:
        print("❌ No admin user found")
        return False
    
    # Try to deactivate self
    response = requests.post(f"{API_BASE_URL}/admin/users/{admin_user['id']}/deactivate", headers=headers)
    
    if response.status_code == 403:
        print("✅ Self-deactivation correctly prevented (403 Forbidden)")
        return True
    else:
        print(f"❌ Self-deactivation should be prevented but got: {response.status_code}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting User Management Actions API Tests\n")
    
    # Test 1: Login as admin
    token = test_login_as_admin()
    if not token:
        print("❌ Cannot proceed without admin token")
        sys.exit(1)
    
    # Test 2: Get users
    test_user = test_get_users(token)
    if not test_user:
        print("⚠️ Skipping user activation/deactivation tests - no test user available")
    else:
        user_id = test_user['id']
        username = test_user['username']
        initial_status = test_user['is_active']
        
        # Test 3 & 4: Activation and Deactivation
        if initial_status:
            # User is active, test deactivation then activation
            test_user_deactivation(token, user_id, username)
            test_user_activation(token, user_id, username)
        else:
            # User is inactive, test activation then deactivation
            test_user_activation(token, user_id, username)
            test_user_deactivation(token, user_id, username)
    
    # Test 5: Self-deactivation prevention
    test_self_deactivation_prevention(token)
    
    print("\n🎉 All tests completed!")

if __name__ == "__main__":
    main()