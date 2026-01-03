import { UserSettings } from "@/components/user-settings"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function SettingsPage() {
  return (
    <DashboardLayout allowedRoles={["admin", "project_manager", "developer", "client"]}>
      <UserSettings />
    </DashboardLayout>
  )
}