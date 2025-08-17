import { AuthGuard } from "@/components/auth-guard"
import { TransactionHistory } from "@/components/transaction-history"

export default function HistoryPage() {
  return (
    <AuthGuard>
      <TransactionHistory />
    </AuthGuard>
  )
}
