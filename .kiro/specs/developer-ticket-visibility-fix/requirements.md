# Requirements Document

## Introduction

This specification addresses the issue where developers cannot see active tickets in their dashboard. The problem occurs because the developer dashboard is attempting to use admin-only API endpoints instead of developer-specific endpoints, resulting in access denied errors and empty ticket lists.

## Glossary

- **Developer**: A user with developer role who needs to view and manage assigned tickets
- **Active_Tickets**: Tickets that are assigned to a developer and not yet completed
- **Available_Tickets**: Unassigned tickets that developers can self-assign
- **Ticket_Context**: The React context that manages ticket data across the application
- **API_Service**: The service layer that handles API communication with the backend

## Requirements

### Requirement 1: Developer Ticket Access

**User Story:** As a developer, I want to see my assigned tickets in the dashboard, so that I can work on them and track my progress.

#### Acceptance Criteria

1. WHEN a developer accesses their dashboard THEN the system SHALL display their assigned active tickets
2. WHEN a developer has no assigned tickets THEN the system SHALL show an appropriate empty state message
3. WHEN a developer views their active tickets THEN the system SHALL show ticket details including priority, status, and creation date
4. THE system SHALL use developer-specific API endpoints instead of admin endpoints for ticket retrieval
5. THE system SHALL handle authentication errors gracefully when accessing developer endpoints

### Requirement 2: Available Ticket Visibility

**User Story:** As a developer, I want to see available unassigned tickets, so that I can self-assign work when I have capacity.

#### Acceptance Criteria

1. WHEN a developer views the Available tab THEN the system SHALL display all unassigned open tickets
2. WHEN there are no available tickets THEN the system SHALL show an appropriate empty state message
3. WHEN a developer clicks self-assign on an available ticket THEN the system SHALL assign the ticket to them
4. THE system SHALL refresh the ticket lists after successful self-assignment
5. THE system SHALL prevent developers from seeing tickets they cannot access

### Requirement 3: Completed Ticket History

**User Story:** As a developer, I want to see my completed tickets, so that I can track my work history and performance.

#### Acceptance Criteria

1. WHEN a developer views the Completed tab THEN the system SHALL display their completed tickets
2. WHEN a developer has no completed tickets THEN the system SHALL show an appropriate empty state message
3. THE system SHALL show completion dates and any completion notes for completed tickets
4. THE system SHALL order completed tickets by completion date (most recent first)

### Requirement 4: Role-Based API Access

**User Story:** As a system architect, I want proper role-based API access, so that developers only access endpoints they have permission for.

#### Acceptance Criteria

1. THE Ticket_Context SHALL use role-appropriate API endpoints based on user role
2. WHEN a developer user accesses ticket data THEN the system SHALL use developer-specific endpoints
3. WHEN an admin user accesses ticket data THEN the system SHALL use admin endpoints
4. THE system SHALL handle 403 Forbidden errors gracefully when wrong endpoints are used
5. THE API_Service SHALL provide separate methods for different user roles

### Requirement 5: Dashboard Statistics Accuracy

**User Story:** As a developer, I want accurate statistics on my dashboard, so that I can understand my workload and performance.

#### Acceptance Criteria

1. THE Active Tickets count SHALL reflect the actual number of assigned open tickets
2. THE Completed count SHALL reflect the actual number of completed tickets by the developer
3. THE Available count SHALL reflect the actual number of unassigned open tickets
4. THE Total Assigned count SHALL reflect all tickets ever assigned to the developer
5. THE statistics SHALL update in real-time when tickets are assigned, completed, or self-assigned

### Requirement 6: Error Handling and User Experience

**User Story:** As a developer, I want clear feedback when there are issues accessing tickets, so that I understand what's happening.

#### Acceptance Criteria

1. WHEN API calls fail THEN the system SHALL show appropriate error messages
2. WHEN loading tickets THEN the system SHALL show loading indicators
3. WHEN authentication fails THEN the system SHALL redirect to login or show auth error
4. THE system SHALL retry failed requests with exponential backoff
5. THE system SHALL cache ticket data to improve performance and reduce API calls

### Requirement 7: Developer Ticket Actions

**User Story:** As a developer, I want to pass or cancel tickets that I cannot resolve, and update ticket status as I work on them, so that I can manage my workflow effectively.

#### Acceptance Criteria

1. WHEN a developer cannot resolve a ticket THEN the system SHALL allow the developer to pass the ticket to another developer
2. WHEN a developer determines a ticket cannot be resolved THEN the system SHALL allow the developer to cancel the ticket
3. WHEN passing or canceling a ticket THEN the system SHALL require the developer to provide a detailed reason
4. WHEN a ticket is passed THEN the system SHALL notify admins and PMs for reassignment
5. WHEN a ticket is canceled THEN the system SHALL notify the client with the developer's explanation and mark the ticket as closed
6. WHEN a developer views their active tickets THEN the system SHALL provide a status dropdown with options: "In Progress" and "Close"
7. WHEN a developer changes ticket status to "Close" THEN the system SHALL require completion notes
8. THE system SHALL update ticket status immediately when changed via dropdown