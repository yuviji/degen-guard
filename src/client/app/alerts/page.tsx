import { AuthGuard } from "@/components/auth-guard"
import { AlertsNotifications } from "@/components/alerts-notifications"

export default function AlertsPage() {
  return (
    <AuthGuard>
      <AlertsNotifications />
    </AuthGuard>
  )
}
