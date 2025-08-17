import { AuthGuard } from "@/components/auth-guard"
import { Settings } from "@/components/settings"

export default function SettingsPage() {
  return (
    <AuthGuard>
      <Settings />
    </AuthGuard>
  )
}
