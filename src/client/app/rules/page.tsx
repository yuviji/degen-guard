import { AuthGuard } from "@/components/auth-guard"
import { RulesManagement } from "@/components/rules-management"

export default function RulesPage() {
  return (
    <AuthGuard>
      <RulesManagement />
    </AuthGuard>
  )
}
