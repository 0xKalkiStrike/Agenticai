import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketTable } from '@/components/ticket-table'
import type { Ticket, User } from '@/lib/types'

// Mock data
const mockTicket: Ticket = {
  id: 1,
  userId: 1,
  query: 'Test ticket',
  reply: null,
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  assignedDeveloperId: 2,
  assignedBy: 1,
  assignedAt: '2024-01-01T10:00:00Z',
  assignmentNotes: null,
  completedAt: null,
  completionNotes: null,
  createdAt: '2024-01-01T09:00:00Z',
  updatedAt: null,
  clientName: 'Test Client',
  developerName: 'Test Developer',
  assignedByName: 'Test Admin'
}

const mockUnassignedTicket: Ticket = {
  ...mockTicket,
  id: 2,
  assignedDeveloperId: null,
  assignedBy: null,
  assignedAt: null,
  developerName: null,
  assignedByName: null,
  status: 'OPEN'
}

const mockDevelopers: User[] = [
  {
    id: 2,
    username: 'developer1',
    email: 'dev1@test.com',
    role: 'developer',
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
    isActive: true
  }
]

describe('TicketTable Basic Functionality', () => {
  it('should display ticket information correctly', () => {
    render(
      <TicketTable
        tickets={[mockTicket]}
        developers={mockDevelopers}
        showAssign={true}
        currentUserId={1}
        currentUserRole="admin"
      />
    )

    // Should show ticket details
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('Test ticket')).toBeInTheDocument()
    expect(screen.getByText('Test Client')).toBeInTheDocument()
    expect(screen.getByText('Test Developer')).toBeInTheDocument()
  })

  it('should show assignment lock badge when ticket is locked', () => {
    const ticketWithLock: Ticket = {
      ...mockTicket,
      assignmentLock: {
        id: 'lock-1',
        ticketId: 1,
        lockedBy: 3,
        lockedByName: 'Another User',
        lockedByRole: 'admin',
        lockedAt: '2024-01-01T10:30:00Z',
        expiresAt: '2024-01-01T10:35:00Z',
        isActive: true
      }
    }

    render(
      <TicketTable
        tickets={[ticketWithLock]}
        developers={mockDevelopers}
        showAssign={true}
        currentUserId={1}
        currentUserRole="admin"
      />
    )

    // Should show the lock badge
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('should disable actions when ticket is locked by another user', () => {
    const ticketWithLock: Ticket = {
      ...mockTicket,
      assignmentLock: {
        id: 'lock-1',
        ticketId: 1,
        lockedBy: 3, // Different user
        lockedByName: 'Another User',
        lockedByRole: 'admin',
        lockedAt: '2024-01-01T10:30:00Z',
        expiresAt: '2024-01-01T10:35:00Z',
        isActive: true
      }
    }

    render(
      <TicketTable
        tickets={[ticketWithLock]}
        developers={mockDevelopers}
        showAssign={true}
        showDeveloperActions={true}
        currentUserId={1} // Different from lockedBy
        currentUserRole="admin"
      />
    )

    // Action buttons should be disabled when ticket is locked by another user
    const actionButtons = screen.getAllByRole('button')
    const disabledButtons = actionButtons.filter(button => button.hasAttribute('disabled'))
    expect(disabledButtons.length).toBeGreaterThan(0)
  })

  it('should show search and filter functionality', () => {
    render(
      <TicketTable
        tickets={[mockTicket, mockUnassignedTicket]}
        developers={mockDevelopers}
        showAssign={true}
        currentUserId={1}
        currentUserRole="admin"
      />
    )

    // Should show search input
    expect(screen.getByPlaceholderText('Search tickets...')).toBeInTheDocument()
    
    // Should show status filter
    expect(screen.getByText('All Status')).toBeInTheDocument()
    
    // Should show priority filter
    expect(screen.getByText('All Priority')).toBeInTheDocument()
  })
})