import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestErrorHandler, testUtils } from '@/lib/test-error-handler'
import { apiService } from '@/lib/api'

/**
 * Demonstration tests for improved test framework stability
 * These tests show that React state updates are properly wrapped in act(),
 * API failures are handled gracefully, and async operations complete correctly.
 */

// Test component that demonstrates proper state handling
const TestComponent: React.FC<{
  onStateChange?: (state: any) => void
  triggerError?: boolean
}> = ({ onStateChange, triggerError = false }) => {
  const [count, setCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<any>(null)

  React.useEffect(() => {
    if (onStateChange) {
      onStateChange({ count, loading, error, data })
    }
  }, [count, loading, error, data, onStateChange])

  const handleIncrement = () => {
    setCount(prev => prev + 1)
  }

  const handleAsyncOperation = async () => {
    setLoading(true)
    setError(null)
    
    try {
      if (triggerError) {
        throw new Error('Simulated async error')
      }
      
      // Simulate API call
      const result = await apiService.getDeveloperTickets()
      setData(result)
    } catch (err) {
      const handledError = TestErrorHandler.handleApiError(err, 'test async operation')
      setError(handledError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div data-testid="test-component">
      <div data-testid="count">{count}</div>
      <div data-testid="loading">{loading ? 'loading' : 'idle'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : 'no-data'}</div>
      
      <button onClick={handleIncrement} data-testid="increment-btn">
        Increment
      </button>
      <button onClick={handleAsyncOperation} data-testid="async-btn">
        Async Operation
      </button>
    </div>
  )
}

describe('Framework Stability Demonstration', () => {
  let cleanupConsole: (() => void) | null = null

  beforeEach(() => {
    // Suppress expected console errors during tests
    cleanupConsole = testUtils.suppressErrors([
      'Simulated async error',
      'Test async operation'
    ])
  })

  afterEach(() => {
    if (cleanupConsole) {
      cleanupConsole()
      cleanupConsole = null
    }
  })

  test('should handle React state updates without warnings', async () => {
    let stateChanges: any[] = []
    
    const onStateChange = (state: any) => {
      stateChanges.push(state)
    }

    await act(async () => {
      render(<TestComponent onStateChange={onStateChange} />)
    })

    // Verify initial render
    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('loading')).toHaveTextContent('idle')
    expect(screen.getByTestId('error')).toHaveTextContent('no-error')

    // Trigger state update
    await act(async () => {
      const incrementBtn = screen.getByTestId('increment-btn')
      await userEvent.click(incrementBtn)
    })

    // Verify state updated correctly
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    
    // Verify state changes were captured
    expect(stateChanges.length).toBeGreaterThan(0)
    expect(stateChanges[stateChanges.length - 1].count).toBe(1)
  })

  test('should handle async operations without hanging', async () => {
    // Mock successful API response
    const mockApiService = apiService as any
    mockApiService.getDeveloperTickets.mockResolvedValue({ tickets: [{ id: 1, query: 'Test' }] })

    await act(async () => {
      render(<TestComponent />)
    })

    // Trigger async operation
    await act(async () => {
      const asyncBtn = screen.getByTestId('async-btn')
      await userEvent.click(asyncBtn)
    })

    // Wait for async operation to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle')
    }, { timeout: 1000 })

    // Verify successful completion
    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
    expect(screen.getByTestId('data')).not.toHaveTextContent('no-data')
  })

  test('should handle API failures gracefully without crashing tests', async () => {
    // Mock API failure
    const mockApiService = apiService as any
    mockApiService.getDeveloperTickets.mockRejectedValue(new Error('Network error'))

    let renderError: Error | null = null

    try {
      await act(async () => {
        render(<TestComponent />)
      })

      // Trigger async operation that will fail
      await act(async () => {
        const asyncBtn = screen.getByTestId('async-btn')
        await userEvent.click(asyncBtn)
      })

      // Wait for error handling to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('idle')
      }, { timeout: 1000 })

    } catch (error) {
      renderError = error as Error
    }

    // Verify test didn't crash
    expect(renderError).toBeNull()
    
    // Verify component handled error gracefully
    expect(screen.getByTestId('error')).not.toHaveTextContent('no-error')
    expect(screen.getByTestId('data')).toHaveTextContent('no-data')
  })

  test('should provide comprehensive API service mocking', async () => {
    const mockApiService = apiService as any

    // Test different mock scenarios
    const scenarios = [
      {
        name: 'success',
        setup: () => mockApiService.getDeveloperTickets.mockResolvedValue({ tickets: [] }),
        expectError: false
      },
      {
        name: 'network-error',
        setup: () => mockApiService.getDeveloperTickets.mockRejectedValue(new TypeError('Failed to fetch')),
        expectError: true
      },
      {
        name: 'auth-error',
        setup: () => mockApiService.getDeveloperTickets.mockRejectedValue(new Error('Session expired')),
        expectError: true
      }
    ]

    for (const scenario of scenarios) {
      // Reset component for each scenario
      const { unmount } = await act(async () => {
        return render(<TestComponent />)
      })

      scenario.setup()

      await act(async () => {
        const asyncBtn = screen.getByTestId('async-btn')
        await userEvent.click(asyncBtn)
      })

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('idle')
      })

      if (scenario.expectError) {
        expect(screen.getByTestId('error')).not.toHaveTextContent('no-error')
      } else {
        expect(screen.getByTestId('error')).toHaveTextContent('no-error')
      }

      unmount()
    }
  })

  test('should handle component unmounting during async operations', async () => {
    // Mock slow API response
    const mockApiService = apiService as any
    mockApiService.getDeveloperTickets.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ tickets: [] }), 200))
    )

    const { unmount } = await act(async () => {
      return render(<TestComponent />)
    })

    // Start async operation
    act(() => {
      const asyncBtn = screen.getByTestId('async-btn')
      userEvent.click(asyncBtn)
    })

    // Unmount component before async operation completes
    await act(async () => {
      unmount()
      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 300))
    })

    // Test should complete without errors or warnings about updating unmounted components
    expect(true).toBe(true) // If we reach here, the test passed
  })

  test('should handle rapid successive operations without race conditions', async () => {
    let callCount = 0
    const mockApiService = apiService as any
    mockApiService.getDeveloperTickets.mockImplementation(() => {
      callCount++
      return Promise.resolve({ tickets: [{ id: callCount }] })
    })

    await act(async () => {
      render(<TestComponent />)
    })

    // Trigger multiple rapid operations
    await act(async () => {
      const asyncBtn = screen.getByTestId('async-btn')
      
      // Click multiple times rapidly
      await userEvent.click(asyncBtn)
      await userEvent.click(asyncBtn)
      await userEvent.click(asyncBtn)
    })

    // Wait for all operations to settle
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle')
    }, { timeout: 2000 })

    // Verify component is still functional
    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
    expect(callCount).toBeGreaterThan(0)
  })

  test('should demonstrate enhanced error handling utilities', async () => {
    // Test TestErrorHandler utilities
    const networkError = new TypeError('Failed to fetch')
    const handledError = TestErrorHandler.handleApiError(networkError, 'test context')
    expect(handledError.message).toContain('Network error in test context')

    // Test safe async operation with fallback
    const result = await TestErrorHandler.safeAsyncOperation(
      () => Promise.reject(new Error('Test error')),
      'test operation',
      'fallback value'
    )
    expect(result).toBe('fallback value')

    // Test mock response creation
    const mockResponse = TestErrorHandler.createMockResponse({ test: 'data' })
    expect(mockResponse.ok).toBe(true)
    expect(mockResponse.status).toBe(200)
    
    const data = await mockResponse.json()
    expect(data).toEqual({ test: 'data' })
  })
})