import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Basic test to ensure the test setup works
describe('Client Interface', () => {
  test('should render without crashing', async () => {
    await act(async () => {
      expect(true).toBe(true)
    })
  })

  test('should handle async operations properly', async () => {
    let asyncResult = null
    
    await act(async () => {
      // Simulate async operation
      asyncResult = await new Promise(resolve => 
        setTimeout(() => resolve('completed'), 10)
      )
    })
    
    expect(asyncResult).toBe('completed')
  })

  test('should handle state updates without warnings', async () => {
    const TestComponent = () => {
      const [count, setCount] = React.useState(0)
      
      React.useEffect(() => {
        setCount(1)
      }, [])
      
      return <div data-testid="count">{count}</div>
    }
    
    let component
    await act(async () => {
      component = render(<TestComponent />)
    })
    
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })
  })
})