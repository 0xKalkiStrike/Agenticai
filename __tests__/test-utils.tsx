import React from 'react'
import { render, RenderOptions, act } from '@testing-library/react'
import { AuthProvider } from '@/lib/auth-context'
import { TicketProvider } from '@/lib/ticket-context'
import type { User } from '@/lib/types'

// Mock user for testing
const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'developer',
  createdAt: '2024-01-01T00:00:00Z',
  lastLogin: null,
  isActive: true
}

// Enhanced wrapper with all providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <TicketProvider>
        {children}
      </TicketProvider>
    </AuthProvider>
  )
}

// Custom render function that wraps components with providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Async wrapper that properly handles React state updates
export const renderWithAct = async (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  let result: any
  await act(async () => {
    result = customRender(ui, options)
  })
  return result
}

// Utility to wait for async operations to complete
export const waitForAsyncOperations = async (timeout = 100) => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, timeout))
  })
}

// Utility to safely trigger events with act()
export const safeUserEvent = {
  async click(element: Element) {
    await act(async () => {
      const { userEvent } = await import('@testing-library/user-event')
      const user = userEvent.setup()
      await user.click(element)
    })
  },
  
  async type(element: Element, text: string) {
    await act(async () => {
      const { userEvent } = await import('@testing-library/user-event')
      const user = userEvent.setup()
      await user.type(element, text)
    })
  }
}

// Mock API responses helper
export const mockApiResponses = {
  success: (data: any = {}) => ({
    ok: true,
    status: 200,
    json: async () => data,
  }),
  
  error: (status: number, message: string) => ({
    ok: false,
    status,
    json: async () => ({ detail: message }),
  }),
  
  networkError: () => {
    throw new TypeError('Failed to fetch')
  }
}

// Test component that safely handles state updates
export const TestComponentWrapper: React.FC<{
  children: React.ReactNode
  onMount?: () => void
  onUpdate?: () => void
}> = ({ children, onMount, onUpdate }) => {
  const [mounted, setMounted] = React.useState(false)
  
  React.useEffect(() => {
    if (!mounted) {
      setMounted(true)
      if (onMount) {
        onMount()
      }
    } else if (onUpdate) {
      onUpdate()
    }
  }, [mounted, onMount, onUpdate])
  
  return <div data-testid="test-wrapper">{children}</div>
}

// Error boundary for testing error scenarios
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error)
    }
  }
  
  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">Something went wrong</div>
    }
    
    return this.props.children
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }
export { mockUser }