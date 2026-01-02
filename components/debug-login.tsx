"use client"

import { useState, useEffect } from "react"

export default function DebugLogin() {
  const [inputValue, setInputValue] = useState("")
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `${timestamp}: ${message}`])
  }

  useEffect(() => {
    addLog("Component mounted")
    
    // Listen for page reload events
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      addLog("Page is about to reload!")
      console.log("Page is about to reload!")
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      addLog("Component unmounting")
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    addLog(`Input changed: "${value}"`)
    setInputValue(value)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addLog("Form submitted (prevented)")
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Debug Login Test</h2>
      
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label htmlFor="test-input" className="block text-sm font-medium mb-1">
            Test Input (type something):
          </label>
          <input
            id="test-input"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type here to test..."
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        >
          Test Submit
        </button>
      </form>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Debug Logs:</h3>
        <div className="bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="text-sm font-mono">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Try typing in the input field above</li>
          <li>Watch the debug logs to see what happens</li>
          <li>If the page refreshes, you'll see "Page is about to reload!" in the logs</li>
          <li>Check the browser console for any JavaScript errors</li>
        </ul>
      </div>
    </div>
  )
}