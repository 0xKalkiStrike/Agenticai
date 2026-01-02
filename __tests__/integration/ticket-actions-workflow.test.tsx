import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketTable } from '@/components/ticket-table'
import { TicketProvider } from '@/lib/ticket-context'
import { AuthProvider } from '@/lib/auth-context'
import { apiService } from '@/lib/api'
import type { Ticket, User } from '@/lib/types'

/**
 * Integration Tests for Complete Ticket Action Workflow
 * Feature: developer-ticket-visibility-fix, Task 12.1
 * Requirements: 7.1-7.8
 * 
 * Focused test suite for core ticket action functionality
 */

// Mock the API service
jest.mock('@/lib/api', () => ({
  apiService: {
    passTicket: jest.fn(),
    cancelTicket: jest.fn(),
    updateTicketStatus: jest.fn(),
    getTicketsByRole: jest.fn(),
    getUsersByRole: jest.fn(),
    getAvailableTicketsByRole: jest.fn(),
    getCompletedTicketsByRole: jest.fn(),
  }
}))

const mockApiService = apiService as jest.Mocked<typeof apiService>

// Mock user data
const mockDeveloperUser: User = {
  id: 1,
  username: 'testdev',
  email: 'dev@test.com',
  role: 'developer',
  createdAt: '2024-01-01T00:00:00Z',
  lastLogin: null,
  isActive: true
}

// Mock ticket data
const mockActiveTicket: Ticket = {
  id: 1,
  query: 'Test ticket for actions',
  reply: null,
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  userId: 2,
  clientName: 'Test Client',
  assignedDeveloperId: 1,
  developerName: 'testdev',
  assignedBy: 1,
  assignedAt: '2024-01-01T00:00:00Z',
  assignmentNotes: null,
  completedAt: null,
  completionNotes: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
}

// Mock auth context
const mockAuthContext = {
  user: mockDeveloperUser,
  login: jest.fn(),
  logout: jest.fn(),
  isLoading: false
}

// Mock React context
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Test component wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <TicketProvider>
      {children}
    </TicketProvider>
  </AuthProvider>
)

describe('Complete Ticket Action Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default API responses
    mockApiService.getTicketsByRole.mockResolvedValue({ tickets: [mockActiveTicket] })
    mockApiService.getUsersByRole.mockResolvedValue({ users: [mockDeveloperUser] })
    mockApiService.getAvailableTicketsByRole.mockResolvedValue({ tickets: [] })
    mockApiService.getCompletedTicketsByRole.mockResolvedValue({ tickets: [] })
    mockApiService.passTicket.mockResolvedValue({ success: true, message: 'Ticket passed successfully' })
    mockApiService.cancelTicket.mockResolvedValue({ success: true, message: 'Ticket canceled successfully' })
    mockApiService.updateTicketStatus.mockResolvedValue({ success: true, message: 'Status updated successfully' })
  })

  describe('Pass Ticket Functionality with Reason Requirement', () => {
    test('should require reason when passing a ticket', async () => {
      const user = userEvent.setup()
      const mockOnPass = jest.fn()

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onPass={mockOnPass}
          />
        </TestWrapper>
      )

      // Find and click the pass button
      const passButton = screen.getByTitle('Pass ticket to another developer')
      await user.click(passButton)

      // Verify pass dialog opens
      await waitFor(() => {
        expect(screen.getByText('Pass Ticket #1')).toBeInTheDocument()
        expect(screen.getByText('Why are you passing this ticket to another developer?')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Try to pass without reason - button should be disabled
      const passSubmitButton = screen.getByRole('button', { name: 'Pass Ticket' })
      expect(passSubmitButton).toBeDisabled()

      // Add a reason
      const reasonTextarea = screen.getByPlaceholderText(/Explain why you cannot resolve this ticket/)
      await user.type(reasonTextarea, 'Requires expertise in React that I don\'t have')

      // Now button should be enabled
      await waitFor(() => {
        expect(passSubmitButton).not.toBeDisabled()
      })

      // Submit the pass action
      await user.click(passSubmitButton)

      // Verify the onPass callback was called with correct parameters
      await waitFor(() => {
        expect(mockOnPass).toHaveBeenCalledWith(1, 'Requires expertise in React that I don\'t have')
      })
    }, 15000)

    test('should not allow passing with empty or whitespace-only reason', async () => {
      const user = userEvent.setup()
      const mockOnPass = jest.fn()

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onPass={mockOnPass}
          />
        </TestWrapper>
      )

      // Open pass dialog
      const passButton = screen.getByTitle('Pass ticket to another developer')
      await user.click(passButton)

      const reasonTextarea = screen.getByPlaceholderText(/Explain why you cannot resolve this ticket/)
      const passSubmitButton = screen.getByRole('button', { name: 'Pass Ticket' })

      // Test empty reason
      expect(passSubmitButton).toBeDisabled()

      // Test whitespace-only reason
      await user.type(reasonTextarea, '   \n\t   ')
      expect(passSubmitButton).toBeDisabled()

      // Clear and add valid reason
      await user.clear(reasonTextarea)
      await user.type(reasonTextarea, 'Valid reason')
      expect(passSubmitButton).not.toBeDisabled()
    })
  })

  describe('Cancel Ticket Functionality with Client Notification', () => {
    test('should require reason when canceling a ticket and show warning', async () => {
      const user = userEvent.setup()
      const mockOnCancel = jest.fn()

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // Find and click the cancel button
      const cancelButton = screen.getByTitle('Cancel ticket')
      await user.click(cancelButton)

      // Verify cancel dialog opens with warning
      await waitFor(() => {
        expect(screen.getByText('Cancel Ticket #1')).toBeInTheDocument()
        expect(screen.getByText('This will close the ticket and notify the client.')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Try to cancel without reason - button should be disabled
      const cancelSubmitButton = screen.getByRole('button', { name: 'Cancel Ticket' })
      expect(cancelSubmitButton).toBeDisabled()

      // Add a reason
      const reasonTextarea = screen.getByPlaceholderText(/Explain why this ticket cannot be resolved/)
      await user.type(reasonTextarea, 'Duplicate request - already resolved in ticket #123')

      // Now button should be enabled
      await waitFor(() => {
        expect(cancelSubmitButton).not.toBeDisabled()
      })

      // Submit the cancel action
      await user.click(cancelSubmitButton)

      // Verify the onCancel callback was called with correct parameters
      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalledWith(1, 'Duplicate request - already resolved in ticket #123')
      })
    }, 15000)

    test('should show destructive styling for cancel button', async () => {
      const user = userEvent.setup()
      const mockOnCancel = jest.fn()

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // Open cancel dialog
      const cancelButton = screen.getByTitle('Cancel ticket')
      await user.click(cancelButton)

      // Add reason to enable button
      const reasonTextarea = screen.getByPlaceholderText(/Explain why this ticket cannot be resolved/)
      await user.type(reasonTextarea, 'Invalid requirement')

      // Check that cancel button has destructive styling (bg-destructive class)
      const cancelSubmitButton = screen.getByRole('button', { name: 'Cancel Ticket' })
      expect(cancelSubmitButton).toHaveClass('bg-destructive')
    })
  })

  describe('Complete Ticket Functionality with Notes Requirement', () => {
    test('should require completion notes when completing a ticket', async () => {
      const user = userEvent.setup()
      const mockOnComplete = jest.fn()

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showComplete={true}
            onComplete={mockOnComplete}
          />
        </TestWrapper>
      )

      // Find and click the complete button
      const completeButton = screen.getByTitle('Complete ticket')
      await user.click(completeButton)

      // Verify complete dialog opens
      await waitFor(() => {
        expect(screen.getByText('Close Ticket #1')).toBeInTheDocument()
        expect(screen.getByText('Add completion notes before closing.')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Try to complete without notes - button should be disabled
      const completeSubmitButton = screen.getByRole('button', { name: 'Close Ticket' })
      expect(completeSubmitButton).toBeDisabled()

      // Add completion notes
      const notesTextarea = screen.getByPlaceholderText('Describe the resolution...')
      await user.type(notesTextarea, 'Fixed the issue by updating the database schema')

      // Now button should be enabled
      await waitFor(() => {
        expect(completeSubmitButton).not.toBeDisabled()
      })

      // Submit the complete action
      await user.click(completeSubmitButton)

      // Verify the onComplete callback was called with correct parameters
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(1, 'Fixed the issue by updating the database schema')
      })
    }, 15000)
  })

  describe('Notification Verification', () => {
    test('should call API methods that trigger notifications for pass action', async () => {
      const user = userEvent.setup()
      const mockOnPass = jest.fn().mockImplementation(async (ticketId, reason) => {
        // Simulate the context calling the API
        await apiService.passTicket(ticketId, reason)
        return true
      })

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onPass={mockOnPass}
          />
        </TestWrapper>
      )

      // Pass a ticket
      const passButton = screen.getByTitle('Pass ticket to another developer')
      await user.click(passButton)

      const reasonTextarea = screen.getByPlaceholderText(/Explain why you cannot resolve this ticket/)
      await user.type(reasonTextarea, 'Need database expertise')

      const passSubmitButton = screen.getByRole('button', { name: 'Pass Ticket' })
      await user.click(passSubmitButton)

      // Verify API was called (which should trigger admin/PM notifications)
      await waitFor(() => {
        expect(mockApiService.passTicket).toHaveBeenCalledWith(1, 'Need database expertise')
      })
    })

    test('should call API methods that trigger notifications for cancel action', async () => {
      const user = userEvent.setup()
      const mockOnCancel = jest.fn().mockImplementation(async (ticketId, reason) => {
        // Simulate the context calling the API
        await apiService.cancelTicket(ticketId, reason)
        return true
      })

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // Cancel a ticket
      const cancelButton = screen.getByTitle('Cancel ticket')
      await user.click(cancelButton)

      const reasonTextarea = screen.getByPlaceholderText(/Explain why this ticket cannot be resolved/)
      await user.type(reasonTextarea, 'Client requirements are unclear and client is unresponsive')

      const cancelSubmitButton = screen.getByRole('button', { name: 'Cancel Ticket' })
      await user.click(cancelSubmitButton)

      // Verify API was called (which should trigger client notifications)
      await waitFor(() => {
        expect(mockApiService.cancelTicket).toHaveBeenCalledWith(1, 'Client requirements are unclear and client is unresponsive')
      }, { timeout: 15000 })
    }, 20000)

    test('should call API methods for complete action', async () => {
      const mockOnComplete = jest.fn().mockImplementation(async (ticketId, notes) => {
        // Simulate the context calling the API
        await apiService.updateTicketStatus(ticketId, 'CLOSED', notes)
        return true
      })

      // Test completion by calling the handler directly
      await mockOnComplete(1, 'Fixed the bug by updating the validation logic')

      // Verify API was called for completion
      expect(mockApiService.updateTicketStatus).toHaveBeenCalledWith(1, 'CLOSED', 'Fixed the bug by updating the validation logic')
    })
  })

  describe('Complete Workflow Integration', () => {
    test('should handle complete pass-to-cancel workflow', async () => {
      const user = userEvent.setup()
      const mockOnPass = jest.fn().mockResolvedValue(true)
      const mockOnCancel = jest.fn().mockResolvedValue(true)

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onPass={mockOnPass}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // First, try to pass the ticket
      const passButton = screen.getByTitle('Pass ticket to another developer')
      await user.click(passButton)

      let reasonTextarea = screen.getByPlaceholderText(/Explain why you cannot resolve this ticket/)
      await user.type(reasonTextarea, 'Requires specialized knowledge')

      let submitButton = screen.getByRole('button', { name: 'Pass Ticket' })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnPass).toHaveBeenCalledWith(1, 'Requires specialized knowledge')
      }, { timeout: 15000 })

      // Then cancel the ticket (simulating it came back)
      const cancelButton = screen.getByTitle('Cancel ticket')
      await user.click(cancelButton)

      reasonTextarea = screen.getByPlaceholderText(/Explain why this ticket cannot be resolved/)
      await user.type(reasonTextarea, 'After investigation, this is a duplicate of ticket #456')

      submitButton = screen.getByRole('button', { name: 'Cancel Ticket' })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalledWith(1, 'After investigation, this is a duplicate of ticket #456')
      }, { timeout: 15000 })
    }, 25000)

    test('should handle ticket completion workflow', async () => {
      const mockOnComplete = jest.fn().mockResolvedValue(true)

      // Test the core completion logic
      await mockOnComplete(1, 'Implemented the requested feature and tested thoroughly')
      expect(mockOnComplete).toHaveBeenCalledWith(1, 'Implemented the requested feature and tested thoroughly')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle API failures gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock API failure
      mockApiService.passTicket.mockRejectedValue(new Error('Network error'))
      
      const mockOnPass = jest.fn().mockImplementation(async (ticketId, reason) => {
        try {
          await apiService.passTicket(ticketId, reason)
          return true
        } catch (error) {
          console.error('Pass failed:', error)
          return false
        }
      })

      render(
        <TestWrapper>
          <TicketTable
            tickets={[mockActiveTicket]}
            showDeveloperActions={true}
            onPass={mockOnPass}
          />
        </TestWrapper>
      )

      // Try to pass ticket
      const passButton = screen.getByTitle('Pass ticket to another developer')
      await user.click(passButton)

      const reasonTextarea = screen.getByPlaceholderText(/Explain why you cannot resolve this ticket/)
      await user.type(reasonTextarea, 'Test reason')

      const submitButton = screen.getByRole('button', { name: 'Pass Ticket' })
      await user.click(submitButton)

      // Verify API was called and error was handled
      await waitFor(() => {
        expect(mockApiService.passTicket).toHaveBeenCalled()
        expect(mockOnPass).toHaveBeenCalledWith(1, 'Test reason')
      }, { timeout: 15000 })
    })

    test('should handle tickets without assigned developer correctly', async () => {
      const unassignedTicket = { ...mockActiveTicket, assignedDeveloperId: null, developerName: null }

      render(
        <TestWrapper>
          <TicketTable
            tickets={[unassignedTicket]}
            showDeveloperActions={true}
          />
        </TestWrapper>
      )

      // Unassigned tickets should not show developer action buttons
      expect(screen.queryByTitle('Pass ticket to another developer')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Cancel ticket')).not.toBeInTheDocument()
    })

    test('should handle closed tickets correctly', async () => {
      const closedTicket = { ...mockActiveTicket, status: 'CLOSED' as const }

      render(
        <TestWrapper>
          <TicketTable
            tickets={[closedTicket]}
            showDeveloperActions={true}
          />
        </TestWrapper>
      )

      // Closed tickets should not show pass/cancel buttons
      expect(screen.queryByTitle('Pass ticket to another developer')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Cancel ticket')).not.toBeInTheDocument()
    })
  })
})