# 🔧 User Settings Feature

## Overview

The IT Support System now includes a comprehensive user settings page where users can:

1. **Toggle between Light/Dark/System theme modes**
2. **Set their personal email for notifications**
3. **Configure notification preferences**
4. **View their profile information**

## 🎨 Theme Toggle Feature

### Available Themes
- **Light Mode**: Clean, bright interface
- **Dark Mode**: Dark background with light text
- **System Mode**: Automatically follows your OS theme preference

### How to Access
1. Go to **Settings** from the user dropdown menu (top right)
2. Use the **Theme Toggle** button in the Appearance section
3. Or use the theme toggle in the top navigation bar

### Technical Implementation
- Uses React Context for theme management
- Persists theme choice in localStorage
- Automatically detects system theme changes
- Smooth transitions between themes

## 📧 Email Notification Settings

### Who Can Set Email
- **Admin**: Full access to email settings
- **Project Manager**: Can set personal email
- **Developer**: Can set personal email
- **Client**: Cannot set email (uses system notifications only)

### Email Configuration
1. Navigate to **Settings**
2. Find the **Email Configuration** section
3. Enter your personal email address
4. Toggle email notifications on/off
5. Click **Save Settings**

### Notification Types
- **Email Notifications**: Receive emails for important updates
- **Browser Notifications**: Show browser popup notifications
- **Ticket Assignment Notifications**: Get notified when tickets are assigned to you
- **Ticket Update Notifications**: Get notified when tickets are updated

## 🚀 How to Use

### Accessing Settings
1. **Click your avatar** in the top right corner
2. Select **Settings** from the dropdown menu
3. Or navigate directly to `/settings`

### Changing Theme
1. In Settings, go to the **Appearance** section
2. Click the **Theme Toggle** button
3. Choose from Light, Dark, or System
4. Theme changes immediately

### Setting Up Email
1. In Settings, find **Email Configuration**
2. Enter your email address
3. Configure which notifications you want
4. Click **Save Settings**
5. You'll see a confirmation message

## 🔧 Technical Details

### Frontend Components
- `components/user-settings.tsx` - Main settings page
- `components/theme-toggle.tsx` - Theme switcher component
- `lib/theme-context.tsx` - Theme management context

### Backend Endpoints
- `GET /user/settings` - Get user settings
- `POST /user/settings` - Update user settings

### Database Table
```sql
CREATE TABLE user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(255) DEFAULT '',
    email_notifications BOOLEAN DEFAULT TRUE,
    browser_notifications BOOLEAN DEFAULT TRUE,
    ticket_assignment_notifications BOOLEAN DEFAULT TRUE,
    ticket_update_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_settings (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Data Storage
- **Theme**: Stored in browser localStorage
- **Settings**: Stored in MySQL database (with localStorage fallback)
- **Automatic fallback**: If database is unavailable, uses localStorage

## 🎯 Features

### ✅ Implemented
- Light/Dark/System theme toggle
- Personal email configuration
- Notification preferences
- Profile information display
- Settings persistence
- Responsive design
- Role-based access control

### 🔄 Theme Persistence
- Theme choice is saved automatically
- Persists across browser sessions
- System theme detection
- Smooth theme transitions

### 📱 Responsive Design
- Works on desktop and mobile
- Touch-friendly controls
- Accessible design
- Clean, modern interface

## 🧪 Testing

### Manual Testing
1. Start the application
2. Login with any user
3. Go to Settings
4. Test theme switching
5. Test email configuration
6. Verify settings are saved

### Automated Testing
```bash
# Run the settings test script
py test_settings.py
```

## 🔍 Troubleshooting

### Theme Not Changing
- Check if JavaScript is enabled
- Clear browser cache
- Check browser console for errors

### Settings Not Saving
- Ensure backend is running
- Check database connection
- Settings will fallback to localStorage if database is unavailable

### Email Not Working
- Verify email format is correct
- Check if your role allows email configuration
- Ensure you clicked "Save Settings"

## 🎉 Benefits

- **Personalized Experience**: Users can customize their interface
- **Better Accessibility**: Dark mode for low-light environments
- **Improved Notifications**: Personal email for important updates
- **User Control**: Full control over notification preferences
- **Modern UX**: Clean, intuitive settings interface

---

**The settings feature provides a complete user customization experience with theme switching and notification management!** 🎯