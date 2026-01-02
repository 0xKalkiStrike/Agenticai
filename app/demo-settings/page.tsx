"use client"

import { NavigationHeader } from "@/components/navigation-header"
import { UserSettings } from "@/components/user-settings"

export default function DemoSettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <main className="container mx-auto py-6 px-4">
        <UserSettings />
      </main>
    </div>
  )
}