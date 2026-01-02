#!/usr/bin/env python3
"""
Test Settings Functionality
Simple test to verify settings endpoints work
"""

import requests
import json

def test_settings_endpoints():
    """Test the user settings endpoints"""
    
    base_url = "http://localhost:8001"
    
    print("🧪 Testing User Settings Functionality...")
    
    # Login first
    login_data = {"username": "Admin", "password": "Admin123"}
    response = requests.post(f"{base_url}/login", json=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return False
    
    token = response.json().get('token')
    headers = {"Authorization": f"Bearer {token}"}
    
    print("✅ Login successful")
    
    # Test getting user settings
    print("🔍 Testing GET /user/settings")
    response = requests.get(f"{base_url}/user/settings", headers=headers)
    if response.status_code == 200:
        settings = response.json()
        print(f"✅ Got user settings: {settings}")
    else:
        print(f"❌ Failed to get settings: {response.status_code}")
        return False
    
    # Test updating user settings
    print("🔍 Testing POST /user/settings")
    new_settings = {
        "email": "admin@localhost.com",
        "emailNotifications": True,
        "browserNotifications": False,
        "ticketAssignmentNotifications": True,
        "ticketUpdateNotifications": False
    }
    
    response = requests.post(f"{base_url}/user/settings", json=new_settings, headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Updated settings: {result}")
    else:
        print(f"❌ Failed to update settings: {response.status_code} - {response.text}")
        return False
    
    # Verify the settings were saved
    print("🔍 Verifying settings were saved")
    response = requests.get(f"{base_url}/user/settings", headers=headers)
    if response.status_code == 200:
        updated_settings = response.json()
        if updated_settings.get("email") == "admin@localhost.com":
            print("✅ Settings were saved correctly")
        else:
            print(f"⚠️ Settings may not have been saved properly: {updated_settings}")
    
    print("\n🎉 Settings functionality test completed!")
    return True

if __name__ == "__main__":
    try:
        test_settings_endpoints()
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        print("Make sure the backend is running: py backend/app/main.py")