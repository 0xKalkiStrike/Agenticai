# Design Document

## Overview

The User Activation Management system extends the existing admin dashboard user table with an Action column containing activate/deactivate buttons and visual styling to clearly indicate user status. The design focuses on intuitive user experience with immediate visual feedback and secure admin-only access controls.

## Architecture

### Component Structure
```
AdminDashboard
├── UserManagementTable (Enhanced)
│   ├── UserRow (Enhanced with status styling)
│   │   ├── UserData (existing columns)
│   │   └── ActionColumn (new)
│   │       └── StatusToggleButton
│   └── StatusNotification (new)
└── UserStatusAPI (backend integration)
```

### Data Flow
1. Admin loads user management table
2. System fetches user data including `isActive` status
3. UI renders rows with appropriate styling and action buttons
4. Admin clicks activate/deactivate button
5. System sends API request to update user status
6. Backend validates admin permissions and updates database
7. Frontend receives response and updates UI immediately
8. Success/error notification displays to admin

## Components and Interfaces

### Enhanced User Table Component

**Location**: `app/dashboard/admin/page.tsx` (All Users Table section)

**New Props**:
```typescript
interface UserTableProps {
  users: User[]
  onUserStatusChange: (userId: number, newStatus: boolean) => Promise<void>
  currentUserId: number // To prevent self-deactivation
  isLoading?: boolean
}
```

**Enhanced User Interface**:
```typescript
interface User {
  id: number
  username: string
  email: string
  role: UserRole
  createdAt: string
  lastLogin: string | null
  isActive: boolean // Already exists, will be used for styling
}
```

### Action Column Component

**New Component**: `components/user-action-column.tsx`

```typescript
interface UserActionColumnProps {
  user: User
  currentUserId: number
  onStatusChange: (userId: number, newStatus: boolean) => Promise<void>
  isLoading?: boolean
}
```

**Features**:
- Conditional button rendering based on `user.isActive`
- Loading state during API calls
- Disabled state for self-management prevention
- Tooltip explanations for disabled states

### Visual Styling System

**Inactive User Row Styling**:
```css
.user-row-inactive {
  opacity: 0.6;
  background-color: rgba(0, 0, 0, 0.02);
  color: #6b7280; /* Gray-500 */
}

.user-row-inactive .user-avatar {
  filter: grayscale(50%);
}

.user-row-inactive .role-badge {
  opacity: 0.7;
  filter: saturate(0.5);
}
```

**Active User Row Styling**:
```css
.user-row-active {
  opacity: 1;
  background-color: transparent;
  color: inherit;
}
```

## Data Models

### User Status Update Request
```typescript
interface UserStatusUpdateRequest {
  userId: number
  isActive: boolean
}
```

### User Status Update Response
```typescript
interface UserStatusUpdateResponse {
  success: boolean
  message: string
  user?: User
}
```

## API Endpoints

### Update User Status
```
PUT /admin/users/{userId}/status
Authorization: Bearer {admin_token}
Content-Type: application/json

Request Body:
{
  "is_active": boolean
}

Response:
{
  "success": true,
  "message": "User status updated successfully",
  "user": {
    "id": 123,
    "username": "testuser",
    "email": "test@example.com",
    "role": "developer",
    "is_active": false,
    "updated_at": "2024-01-02T10:30:00Z"
  }
}
```

### Error Responses
```json
// Permission denied
{
  "success": false,
  "message": "Access denied: Admin privileges required",
  "error_code": "PERMISSION_DENIED"
}

// Self-deactivation attempt
{
  "success": false,
  "message": "Cannot deactivate your own account",
  "error_code": "SELF_DEACTIVATION_DENIED"
}

// Last admin protection
{
  "success": false,
  "message": "Cannot deactivate the last active admin user",
  "error_code": "LAST_ADMIN_PROTECTION"
}
```

## User Interface Design

### Action Column Layout
```
| Username | Email | Role | Status | Action |
|----------|-------|------|--------|--------|
| john_doe | john@ | Dev  | Active | [Deactivate] |
| jane_doe | jane@ | PM   | Inactive | [Activate] |
```

### Button States
- **Active User**: Red "Deactivate" button with warning icon
- **Inactive User**: Green "Activate" button with check icon
- **Loading State**: Disabled button with spinner
- **Self-Management**: Disabled button with tooltip
- **Last Admin**: Disabled button with warning tooltip

### Visual Status Indicators

**Active User Row**:
- Full opacity (1.0)
- Normal text color
- Standard background
- Colored role badges

**Inactive User Row**:
- Reduced opacity (0.6)
- Muted text color (#6b7280)
- Subtle gray background tint
- Desaturated role badges
- Optional strikethrough effect on username

## Error Handling

### Client-Side Error Handling
1. **Network Errors**: Show retry option with exponential backoff
2. **Permission Errors**: Display access denied message
3. **Validation Errors**: Show specific field validation messages
4. **Server Errors**: Display generic error with support contact

### Server-Side Validation
1. **Admin Permission Check**: Verify user has admin role
2. **Self-Deactivation Prevention**: Block users from deactivating themselves
3. **Last Admin Protection**: Prevent deactivation of the only active admin
4. **User Existence Check**: Verify target user exists before update

## Testing Strategy

### Unit Tests
- User action column component rendering
- Button state logic based on user status
- Visual styling application
- Error handling scenarios

### Integration Tests
- API endpoint functionality
- Permission validation
- Database status updates
- Real-time UI updates

### Property-Based Tests
- User status toggle operations
- Admin permission enforcement
- Visual styling consistency

## Security Considerations

### Access Control
- Only admin users can access user management features
- API endpoints require admin authentication
- Frontend hides action column for non-admin users

### Data Validation
- Server-side validation of all status change requests
- Prevention of privilege escalation attempts
- Audit logging of all user status changes

### Business Logic Protection
- Self-deactivation prevention
- Last admin account protection
- Graceful handling of concurrent status changes

## Performance Considerations

### Optimistic Updates
- Immediate UI updates before API confirmation
- Rollback mechanism for failed operations
- Loading states during API calls

### Caching Strategy
- Cache user list with status information
- Invalidate cache on status changes
- Efficient re-rendering of affected rows only

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Button State Consistency
*For any* user in the system, if the user is active, then only the "Deactivate" button should be visible in the Action column, and if the user is inactive, then only the "Activate" button should be visible
**Validates: Requirements 1.2, 1.3**

### Property 2: Status Change Triggers
*For any* action button click by an admin user, the system should trigger the appropriate status change API call with the correct user ID and new status value
**Validates: Requirements 1.5**

### Property 3: Inactive User Visual Styling
*For any* user with inactive status, the user row should have reduced opacity, muted text color, and subtle background color changes applied
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Active User Normal Styling
*For any* user with active status, the user row should display with full opacity and normal styling without any dimming effects
**Validates: Requirements 2.5**

### Property 5: Status Change State Transitions
*For any* user status change operation, clicking "Deactivate" on an active user should result in inactive status, and clicking "Activate" on an inactive user should result in active status
**Validates: Requirements 3.1, 3.2**

### Property 6: UI Updates After Status Changes
*For any* successful status change, the system should immediately update both the visual styling of the user row and the action button to reflect the new status
**Validates: Requirements 3.3, 3.4**

### Property 7: Database Persistence
*For any* status change operation, the system should make an API call to persist the new status to the database with the correct user ID and status value
**Validates: Requirements 3.5**

### Property 8: Error Handling and Reversion
*For any* failed status change operation, the system should revert the UI state to the previous status and display an error notification
**Validates: Requirements 3.6**

### Property 9: Success Feedback
*For any* successful status change operation, the system should display a success notification to provide user feedback
**Validates: Requirements 4.1**

### Property 10: Loading State Management
*For any* status change operation in progress, the action button should be disabled and show a loading state until the operation completes
**Validates: Requirements 4.2, 4.4**

### Property 11: Error Feedback
*For any* failed status change operation, the system should display an error notification with appropriate details about the failure
**Validates: Requirements 4.3**

### Property 12: Data Persistence After Refresh
*For any* user status in the database, after a page refresh, the UI should display the current status from the database accurately
**Validates: Requirements 4.5**

### Property 13: Role-Based Action Column Visibility
*For any* non-admin user viewing the user table, the Action column should not be visible, and for any admin user, the Action column should be visible with appropriate buttons
**Validates: Requirements 5.1, 5.2**

### Property 14: API Permission Validation
*For any* status change API request, the system should validate that the requesting user has admin permissions before processing the request
**Validates: Requirements 5.3**

### Property 15: Non-Admin API Rejection
*For any* status change API request from a non-admin user, the system should return a permission denied error and not modify user status
**Validates: Requirements 5.4**

### Property 16: Self-Management Prevention
*For any* admin user viewing their own user row, the deactivate button should be disabled or hidden to prevent self-deactivation
**Validates: Requirements 6.1**

### Property 17: Self-Deactivation Protection
*For any* attempt by an admin to deactivate their own account, the system should prevent the action and show appropriate warning messages
**Validates: Requirements 6.2, 6.3**

### Property 18: Last Admin Protection
*For any* admin user who is the only active admin in the system, the deactivate button should be disabled to prevent system lockout
**Validates: Requirements 6.4**

## Accessibility

### Keyboard Navigation
- Tab navigation through action buttons
- Enter/Space key activation
- Focus indicators on interactive elements

### Screen Reader Support
- Descriptive button labels
- Status announcements on changes
- Proper ARIA attributes

### Visual Accessibility
- High contrast for inactive user styling
- Clear visual hierarchy
- Consistent color coding