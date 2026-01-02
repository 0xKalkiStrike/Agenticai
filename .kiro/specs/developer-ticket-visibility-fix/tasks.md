# Implementation Plan: Developer Ticket Visibility Fix

## Overview

This implementation plan addresses the critical issue where developers cannot see active tickets in their dashboard due to incorrect API endpoint usage. The solution involves implementing role-based API access and using appropriate developer-specific endpoints.

## Tasks

- [x] 1. Enhance API Service with Developer Endpoints
  - Add developer-specific ticket fetching methods to API service
  - Implement role-based endpoint selection logic
  - Add proper error handling for different user roles
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 1.1 Write property test for role-based API access
  - **Property 1: Role-based API Access**
  - **Validates: Requirements 4.1, 4.2**

- [ ] 2. Modify Ticket Context for Role Awareness
  - [x] 2.1 Add role detection to ticket context
    - Detect user role from auth context
    - Implement conditional API calling based on role
    - _Requirements: 4.1, 4.2_

  - [x] 2.2 Implement developer-specific ticket fetching
    - Add methods for assigned tickets, available tickets, completed tickets
    - Replace admin API calls with developer API calls for developer users
    - _Requirements: 1.1, 2.1, 3.1_

  - [ ]* 2.3 Write property test for ticket data consistency
    - **Property 2: Ticket Data Consistency**
    - **Validates: Requirements 1.1, 2.1**

- [x] 3. Update Dashboard Statistics Calculation
  - [x] 3.1 Fix statistics calculation for developers
    - Use developer-specific ticket data for statistics
    - Ensure accurate counts for assigned, completed, available tickets
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 3.2 Write property test for statistics accuracy

    - **Property 3: Statistics Accuracy**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 4. Implement Comprehensive Error Handling
  - [x] 4.1 Add error handling for API failures
    - Handle 403 Forbidden errors gracefully
    - Implement retry logic with exponential backoff
    - Show user-friendly error messages
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 4.2 Add loading states and user feedback
    - Implement loading indicators for ticket fetching
    - Add empty state messages for different scenarios
    - _Requirements: 6.2, 1.2, 2.2, 3.2_

  - [ ]* 4.3 Write property test for error handling
    - **Property 4: Error Handling Completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 5. Implement Real-time Updates
  - [x] 5.1 Add real-time ticket list updates
    - Refresh ticket lists after assignment operations
    - Update statistics when ticket states change
    - _Requirements: 5.5, 1.4, 2.4_

  - [ ]* 5.2 Write property test for real-time updates
    - **Property 5: Real-time Updates**
    - **Validates: Requirements 5.5, 1.4, 2.4**

- [x] 6. Checkpoint - Test Developer Dashboard Functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Backend Endpoint Verification
  - [x] 7.1 Verify developer API endpoints exist and work
    - Test `/developer/tickets/my-assigned` endpoint
    - Test `/developer/tickets/available` endpoint
    - Ensure proper authentication and authorization
    - _Requirements: 4.2, 4.3_

  - [x] 7.2 Add missing endpoints if needed
    - Implement any missing developer-specific endpoints
    - Ensure consistent response formats
    - _Requirements: 4.2_

- [ ]* 7.3 Write integration tests for API endpoints
  - Test all developer endpoints with real authentication
  - Verify response formats and data accuracy
  - _Requirements: 4.2, 4.3_

- [ ] 8. Update Developer Dashboard Component
  - [x] 8.1 Modify dashboard to use new context methods
    - Update ticket fetching to use role-aware methods
    - Fix statistics display to use accurate data
    - _Requirements: 1.1, 1.3, 5.1, 5.2, 5.3_

  - [x] 8.2 Improve user experience with better states
    - Add proper loading states during ticket fetching
    - Implement better empty state messages
    - Add error recovery options
    - _Requirements: 6.1, 6.2, 1.2, 2.2, 3.2_

- [ ]* 8.3 Write unit tests for dashboard component
  - Test component behavior with different ticket states
  - Test error handling and loading states
  - _Requirements: 6.1, 6.2_

- [ ] 9. Final Integration Testing
  - [x] 9.1 Test complete developer workflow
    - Test developer login and dashboard access
    - Test ticket viewing, self-assignment, and completion
    - Verify statistics accuracy across all operations
    - _Requirements: 1.1, 2.1, 3.1, 5.1-5.5_

  - [x] 9.2 Test error scenarios
    - Test behavior with network failures
    - Test behavior with authentication issues
    - Test behavior with empty ticket states
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Developer Ticket Actions
  - [x] 11.1 Add pass/cancel ticket functionality to API service
    - Add passTicket() method with reason parameter
    - Add cancelTicket() method with reason parameter
    - Add updateTicketStatus() method for status changes
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.2 Create backend endpoints for ticket actions
    - Add POST /developer/tickets/{id}/pass endpoint
    - Add POST /developer/tickets/{id}/cancel endpoint  
    - Add PUT /developer/tickets/{id}/status endpoint
    - Ensure all endpoints require authentication and proper authorization
    - _Requirements: 7.1, 7.2, 7.6, 7.8_

  - [x] 11.3 Add ticket action methods to ticket context
    - Add passTicket() method to context
    - Add cancelTicket() method to context
    - Add updateTicketStatus() method to context
    - Ensure proper error handling and loading states
    - _Requirements: 7.1, 7.2, 7.8_

  - [x] 11.4 Update TicketTable component with action buttons
    - Add "Pass" button with reason dialog
    - Add "Cancel" button with reason dialog
    - Add status dropdown for active tickets
    - Implement confirmation dialogs for destructive actions
    - _Requirements: 7.1, 7.2, 7.6, 7.7_

  - [x] 11.5 Implement notification system for ticket actions
    - Send notifications to admins/PMs when tickets are passed
    - Send notifications to clients when tickets are closed
    - Include developer reasons in all notifications
    - _Requirements: 7.4, 7.5_

  - [x] 11.6 Write property tests for ticket actions

    - **Property 6: Pass ticket requires reason**
    - **Property 7: Cancel ticket requires reason**
    - **Property 8: Status updates are immediate**
    - **Validates: Requirements 7.3, 7.7, 7.8**

- [ ] 12. Final Integration Testing for Ticket Actions
  - [x] 12.1 Test complete ticket action workflow
    - Test pass ticket functionality with reason requirement
    - Test cancel ticket functionality with client notification
    - Test status dropdown updates (In Progress, Close)
    - Verify all notifications are sent correctly
    - _Requirements: 7.1-7.8_

  - [x] 12.2 Test error scenarios for ticket actions
    - Test behavior when pass/cancel fails
    - Test behavior with invalid status changes
    - Test behavior when notifications fail
    - _Requirements: 7.1, 7.2, 7.8_

- [x] 13. Final checkpoint - Ensure all ticket action tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Integration tests validate end-to-end functionality
- Focus on fixing the core issue: developers using wrong API endpoints