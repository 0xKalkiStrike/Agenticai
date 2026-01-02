# Design Document

## Overview

This design addresses the developer ticket visibility issue by implementing role-based API access in the ticket context and ensuring developers use appropriate endpoints to fetch their tickets. The solution involves modifying the ticket context to detect user roles and use the correct API endpoints accordingly.

## Architecture

### Current Problem
- Developer dashboard uses `getAllTickets()` which calls `/admin/tickets/all`
- This endpoint requires admin privileges, causing 403 Forbidden errors for developers
- Results in empty ticket lists and broken dashboard functionality

### Proposed Solution
- Implement role-based ticket fetching in the ticket context
- Use developer-specific endpoints for developer users
- Maintain backward compatibility for admin users
- Add proper error handling and loading states

## Components and Interfaces

### Modified Ticket Context
```typescript
interface TicketContextType {
  // Existing methods remain the same
  tickets: Ticket[]
  users: User[]
  isLoading: boolean
  
  // Enhanced methods with role awareness
  refreshTickets: (force?: boolean, userRole?: string) => Promise<void>
  refreshDeveloperTickets: (developerId: number) => Promise<void>
  refreshAvailableTickets: () => Promise<void>
  
  // Role-specific getters
  getMyAssignedTickets: (developerId: number) => Ticket[]
  getMyAvailableTickets: () => Ticket[]
  getMyCompletedTickets: (developerId: number) => Ticket[]
}
```

### Enhanced API Service
```typescript
class ApiService {
  // Developer-specific methods
  async getDeveloperAssignedTickets(): Promise<any>
  async getDeveloperAvailableTickets(): Promise<any>
  async getDeveloperCompletedTickets(): Promise<any>
  
  // Role-aware ticket fetching
  async getTicketsForRole(role: string, userId?: number): Promise<any>
}
```

## Data Models

### Ticket State Management
```typescript
interface TicketState {
  assignedTickets: Ticket[]      // Developer's assigned tickets
  availableTickets: Ticket[]     // Unassigned tickets for self-assignment
  completedTickets: Ticket[]     // Developer's completed tickets
  allTickets: Ticket[]          // Admin view of all tickets
  isLoading: boolean
  error: string | null
}
```

### API Response Formats
```typescript
// Developer assigned tickets response
interface DeveloperTicketsResponse {
  assigned_tickets: Ticket[]
}

// Available tickets response  
interface AvailableTicketsResponse {
  available_tickets: Ticket[]
}

// Admin all tickets response
interface AdminTicketsResponse {
  tickets: Ticket[]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Role-based API Access
*For any* user with developer role, when fetching tickets, the system should use developer-specific API endpoints and never attempt to access admin-only endpoints
**Validates: Requirements 4.1, 4.2**

### Property 2: Ticket Data Consistency
*For any* developer user, the sum of assigned tickets and available tickets should equal the total tickets visible to that developer
**Validates: Requirements 1.1, 2.1**

### Property 3: Statistics Accuracy
*For any* developer, the dashboard statistics should accurately reflect the actual count of their assigned, completed, and available tickets
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 4: Error Handling Completeness
*For any* API failure scenario, the system should provide appropriate user feedback and not leave the interface in a broken state
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 5: Real-time Updates
*For any* ticket state change (assignment, completion, self-assignment), the dashboard statistics and ticket lists should update to reflect the new state
**Validates: Requirements 5.5, 1.4, 2.4**

## Error Handling

### API Error Scenarios
1. **403 Forbidden**: User lacks permission for endpoint
   - Fallback to role-appropriate endpoint
   - Show user-friendly error message
   
2. **401 Unauthorized**: Authentication token expired
   - Redirect to login page
   - Clear cached data
   
3. **500 Server Error**: Backend service unavailable
   - Show retry option
   - Cache last known good data
   
4. **Network Error**: Connection issues
   - Implement exponential backoff retry
   - Show offline indicator

### Loading States
- Show skeleton loaders for ticket lists
- Display loading spinners for statistics
- Disable interactive elements during operations

## Testing Strategy

### Unit Tests
- Test role detection logic
- Test API endpoint selection based on user role
- Test error handling for different failure scenarios
- Test statistics calculation accuracy

### Property Tests
- **Property 1 Test**: Generate random user roles and verify correct API endpoints are used
- **Property 2 Test**: Generate random ticket assignments and verify data consistency
- **Property 3 Test**: Generate random ticket states and verify statistics accuracy
- **Property 4 Test**: Generate random API failures and verify error handling
- **Property 5 Test**: Generate random state changes and verify real-time updates

### Integration Tests
- Test developer dashboard with real API endpoints
- Test ticket assignment and self-assignment flows
- Test error scenarios with mocked API failures
- Test role switching between admin and developer views

## Implementation Plan

### Phase 1: API Service Enhancement
1. Add developer-specific API methods
2. Implement role-based endpoint selection
3. Add comprehensive error handling

### Phase 2: Ticket Context Modification
1. Modify ticket context to use role-based fetching
2. Add separate state management for different ticket types
3. Implement real-time update mechanisms

### Phase 3: Dashboard Integration
1. Update developer dashboard to use new context methods
2. Add proper loading and error states
3. Test with real developer accounts

### Phase 4: Testing and Validation
1. Implement property-based tests
2. Add integration tests for all user roles
3. Validate error handling scenarios
4. Performance testing with large ticket datasets