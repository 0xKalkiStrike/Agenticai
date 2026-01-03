/**
 * Test for React Hooks order consistency in DeveloperDashboard
 * Feature: project-error-fixes, Property 5: React Hooks Order Consistency
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { render, screen } from '@testing-library/react'
import { useAuth } from '@/lib/auth-context'
import { useTickets } from '@/lib/ticket-context'
import DeveloperDashboard from '@/app/dashboard/developer/page'

// Mock the contexts
jest.mock('@/lib/auth-context')
jest.mock('@/lib/ticket-context')
jest.mock('@/components/dashboard-layout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseTickets = useTickets as jest.MockedFunction<typeof useTickets>

describe('DeveloperDashboard Hooks Order', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Default mock implementations
    mockUseTickets.mockReturnValue({
      tickets: [],
      selfAssignTicket: jest.fn(),
      completeTicket: jest.fn(),
      passTicket: jest.fn(),
      cancelTicket: jest.fn(),
      getAvailableTicketsForRole: jest.fn().mockResolvedValue([]),
      getCompletedTicketsForRole: jest.fn().mockResolvedValue([]),
      subscribeToTicketUpdates: jest.fn().mockReturnValue(() => {}),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
    })
  })

  test('should render without hook order violations when user is null', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    })

    // This should not throw a hook order violation error
    expect(() => {
      render(<DeveloperDashboard />)
    }).not.toThrow()

    // Component should return null when user is null, so dashboard layout should not be rendered
    expect(screen.queryByTestId('dashboard-layout')).not.toBeInTheDocument()
  })

  test('should render without hook order violations when user exists', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'testdev',
        email: 'test@example.com',
        role: 'developer',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    })

    // This should not throw a hook order violation error
    expect(() => {
      render(<DeveloperDashboard />)
    }).not.toThrow()

    // Component should render when user exists
    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
  })

  test('should maintain consistent hook order across multiple renders', () => {
    const { rerender } = render(<DeveloperDashboard />)
    
    // First render with null user
    mockUseAuth.mockReturnValue({
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    })
    
    expect(() => {
      rerender(<DeveloperDashboard />)
    }).not.toThrow()

    // Second render with user
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'testdev',
        email: 'test@example.com',
        role: 'developer',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    })

    expect(() => {
      rerender(<DeveloperDashboard />)
    }).not.toThrow()

    // Third render back to null user
    mockUseAuth.mockReturnValue({
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
    })

    expect(() => {
      rerender(<DeveloperDashboard />)
    }).not.toThrow()
  })
})