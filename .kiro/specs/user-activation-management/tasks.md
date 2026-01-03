# Implementation Plan: User Activation Management

## Overview

This implementation plan creates a user activation/deactivation system with an Action column in the admin user table, featuring activate/deactivate buttons and creative visual styling for inactive users. The implementation includes frontend UI components, backend API endpoints, and comprehensive testing.

## Tasks

- [ ] 1. Create backend API endpoint for user status updates
  - Create PUT `/admin/users/{userId}/status` endpoint in `backend/main.py`
  - Add request/response models for user status updates
  - Implement admin permission validation
  - Add self-deactivation prevention logic
  - Add last admin protection logic
  - _Requirements: 3.5, 5.3, 5.4, 6.3, 6.4_

- [ ]* 1.1 Write property test for user status API endpoint
  - **Property 14: API Permission Validation**
  - **Validates: Requirements 5.3**

- [ ]* 1.2 Write property test for self-deactivation prevention
  - **Property 17: Self-Deactivation Protection**
  - **Validates: Requirements 6.2, 6.3**

- [ ] 2. Add user status update method to API service
  - Add `updateUserStatus` method to `lib/api.ts`
  - Handle API request/response formatting
  - Add error handling for permission and validation errors
  - _Requirements: 3.5, 3.6_

- [ ]* 2.1 Write property test for API service method
  - **Property 7: Database Persistence**
  - **Validates: Requirements 3.5**

- [ ] 3. Create UserActionColumn component
  - Create `components/user-action-column.tsx`
  - Implement conditional button rendering based on user status
  - Add loading states and disabled states
  - Add click handlers for activate/deactivate actions
  - Add tooltips for disabled buttons
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.2, 4.4, 6.1, 6.5_

- [ ]* 3.1 Write property test for button state consistency
  - **Property 1: Button State Consistency**
  - **Validates: Requirements 1.2, 1.3**

- [ ]* 3.2 Write property test for status change triggers
  - **Property 2: Status Change Triggers**
  - **Validates: Requirements 1.5**

- [ ]* 3.3 Write property test for loading state management
  - **Property 10: Loading State Management**
  - **Validates: Requirements 4.2, 4.4**

- [ ] 4. Add visual styling for inactive users
  - Create CSS classes for inactive user rows in global styles
  - Implement opacity reduction, background tinting, and text muting
  - Add grayscale effects for avatars and desaturation for badges
  - Ensure high contrast and accessibility compliance
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ]* 4.1 Write property test for inactive user styling
  - **Property 3: Inactive User Visual Styling**
  - **Validates: Requirements 2.1, 2.2, 2.3**

- [ ]* 4.2 Write property test for active user styling
  - **Property 4: Active User Normal Styling**
  - **Validates: Requirements 2.5**

- [ ] 5. Enhance admin dashboard user table
  - Modify `app/dashboard/admin/page.tsx` to add Action column
  - Integrate UserActionColumn component
  - Add user status change handler
  - Implement optimistic UI updates
  - Add success/error notifications
  - _Requirements: 1.1, 3.3, 3.4, 4.1, 4.3_

- [ ]* 5.1 Write property test for UI updates after status changes
  - **Property 6: UI Updates After Status Changes**
  - **Validates: Requirements 3.3, 3.4**

- [ ]* 5.2 Write property test for success feedback
  - **Property 9: Success Feedback**
  - **Validates: Requirements 4.1**

- [ ]* 5.3 Write property test for error feedback
  - **Property 11: Error Feedback**
  - **Validates: Requirements 4.3**

- [ ] 6. Add user status change to ticket context
  - Add `updateUserStatus` method to `lib/ticket-context.tsx`
  - Implement optimistic updates with rollback on failure
  - Add error handling and user feedback
  - Refresh user list after successful status changes
  - _Requirements: 3.1, 3.2, 3.6, 4.5_

- [ ]* 6.1 Write property test for status change state transitions
  - **Property 5: Status Change State Transitions**
  - **Validates: Requirements 3.1, 3.2**

- [ ]* 6.2 Write property test for error handling and reversion
  - **Property 8: Error Handling and Reversion**
  - **Validates: Requirements 3.6**

- [ ]* 6.3 Write property test for data persistence after refresh
  - **Property 12: Data Persistence After Refresh**
  - **Validates: Requirements 4.5**

- [ ] 7. Implement role-based access control
  - Add conditional rendering of Action column based on user role
  - Hide Action column for non-admin users
  - Add admin role validation in components
  - _Requirements: 5.1, 5.2, 5.5_

- [ ]* 7.1 Write property test for role-based visibility
  - **Property 13: Role-Based Action Column Visibility**
  - **Validates: Requirements 5.1, 5.2**

- [ ] 8. Add self-management prevention
  - Implement current user ID comparison in UserActionColumn
  - Disable deactivate button for current admin user
  - Add warning tooltips for disabled actions
  - _Requirements: 6.1, 6.2, 6.5_

- [ ]* 8.1 Write property test for self-management prevention
  - **Property 16: Self-Management Prevention**
  - **Validates: Requirements 6.1**

- [ ] 9. Implement last admin protection
  - Add logic to detect if user is the only active admin
  - Disable deactivate button for last admin
  - Add appropriate warning messages and tooltips
  - _Requirements: 6.4, 6.5_

- [ ]* 9.1 Write property test for last admin protection
  - **Property 18: Last Admin Protection**
  - **Validates: Requirements 6.4**

- [ ] 10. Add comprehensive error handling
  - Implement network error handling with retry logic
  - Add user-friendly error messages for different failure types
  - Add loading states and timeout handling
  - Implement graceful degradation for API failures
  - _Requirements: 3.6, 4.3_

- [ ]* 10.1 Write property test for non-admin API rejection
  - **Property 15: Non-Admin API Rejection**
  - **Validates: Requirements 5.4**

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Add accessibility features
  - Implement keyboard navigation for action buttons
  - Add ARIA labels and descriptions
  - Add screen reader announcements for status changes
  - Ensure high contrast compliance for inactive styling
  - _Requirements: Visual accessibility and usability_

- [ ]* 12.1 Write unit tests for accessibility features
  - Test keyboard navigation functionality
  - Test ARIA attributes and labels
  - Test screen reader compatibility

- [ ] 13. Final integration and testing
  - Test complete user activation/deactivation workflow
  - Verify visual styling works across different browsers
  - Test error scenarios and edge cases
  - Validate security and permission controls
  - _Requirements: All requirements integration_

- [ ]* 13.1 Write integration tests for complete workflow
  - Test end-to-end user status change process
  - Test admin permission enforcement
  - Test visual feedback and notifications

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation focuses on security, usability, and visual clarity
- Creative CSS styling ensures inactive users are immediately recognizable