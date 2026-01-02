"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "@/lib/theme-context"
import { ThemeToggle } from "./theme-toggle"
import { Mail, Bell, User, Palette, Save, CheckCircle } from "lucide-react"
import { apiService } from "@/lib/api"

interface UserSettings {
  email: string
  emailNotifications: boolean
  browserNotifications: boolean
  ticketAssignmentNotifications: boolean
  ticketUpdateNotifications: boolean
}

export function UserSettings() {
  const { user } = useAuth()
  const { theme, actualTheme } = useTheme()
  const [settings, setSettings] = useState<UserSettings>({
    email: "",
    emailNotifications: true,
    browserNotifications: true,
    ticketAssignmentNotifications: true,
    ticketUpdateNotifications: true
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState("")

  // Check if user can configure email (Admin, PM, Developer)
  const canConfigureEmail = user?.role && ['admin', 'project_manager', 'developer'].includes(user.role)

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      const userSettings = await apiService.getUserSettings()
      setSettings(userSettings)
    } catch (error) {
      // Try to load from localStorage as fallback
      const localSettings = localStorage.getItem('user_settings')
      if (localSettings) {
        try {
          const parsedSettings = JSON.parse(localSettings)
          setSettings(parsedSettings)
        } catch (e) {
          console.log("Using default settings")
        }
      } else {
        console.log("Using default settings")
      }
    }
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    setError("")
    setIsSaved(false)

    try {
      // Validate email if provided
      if (settings.email && !isValidEmail(settings.email)) {
        setError("Please enter a valid email address")
        return
      }

      const result = await apiService.updateUserSettings(settings)
      
      // Check if it was saved locally or to backend
      if (result.message && result.message.includes('locally')) {
        setIsSaved(true)
        // Also show a note that it's saved locally
        console.log("Settings saved locally (backend endpoint not available)")
      } else {
        setIsSaved(true)
      }
      
      // Hide success message after 3 seconds
      setTimeout(() => setIsSaved(false), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save settings"
      
      // If it's a 400 error, try to save locally as fallback
      if (errorMessage.includes('400') || errorMessage.includes('Failed to update settings')) {
        try {
          localStorage.setItem('user_settings', JSON.stringify(settings))
          setIsSaved(true)
          console.log("Settings saved locally as fallback")
          setTimeout(() => setIsSaved(false), 3000)
        } catch (localError) {
          setError("Failed to save settings. Please try again.")
        }
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleInputChange = (field: keyof UserSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
    setIsSaved(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Manage your account preferences and notifications</p>
        </div>
        <ThemeToggle />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isSaved && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Settings saved successfully! 
            {canConfigureEmail && settings.email && (
              <span className="block text-sm mt-1">
                Email notifications will be sent to: {settings.email}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your basic profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username</Label>
              <Input value={user?.username || ""} disabled />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={user?.role?.replace('_', ' ').toUpperCase() || ""} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration - Only for Admin, PM, Developer */}
      {canConfigureEmail && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <CardDescription>
              Configure your personal email for notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Personal Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={settings.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                This email will be used for ticket notifications and system alerts
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {canConfigureEmail && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Browser Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in your browser
              </p>
            </div>
            <Switch
              checked={settings.browserNotifications}
              onCheckedChange={(checked) => handleInputChange('browserNotifications', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ticket Assignment Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when tickets are assigned to you
              </p>
            </div>
            <Switch
              checked={settings.ticketAssignmentNotifications}
              onCheckedChange={(checked) => handleInputChange('ticketAssignmentNotifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ticket Update Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when tickets are updated
              </p>
            </div>
            <Switch
              checked={settings.ticketUpdateNotifications}
              onCheckedChange={(checked) => handleInputChange('ticketUpdateNotifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how the application looks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Current theme: {theme} {theme === 'system' && `(${actualTheme})`}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}