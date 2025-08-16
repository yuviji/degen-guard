"use client"

import { useState } from "react"
import { PortfolioDashboard } from "@/components/portfolio-dashboard"
import { RulesManagement } from "@/components/rules-management"
import { AlertsNotifications } from "@/components/alerts-notifications"
import { TransactionHistory } from "@/components/transaction-history"
import { Settings } from "@/components/settings"
import { Navigation } from "@/components/navigation"
import { ErrorBoundary } from "@/components/error-boundary"

export default function HomePage() {
  const [currentPage, setCurrentPage] = useState("dashboard")

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <ErrorBoundary>
            <PortfolioDashboard />
          </ErrorBoundary>
        )
      case "rules":
        return (
          <ErrorBoundary>
            <RulesManagement />
          </ErrorBoundary>
        )
      case "alerts":
        return (
          <ErrorBoundary>
            <AlertsNotifications />
          </ErrorBoundary>
        )
      case "history":
        return (
          <ErrorBoundary>
            <TransactionHistory />
          </ErrorBoundary>
        )
      case "settings":
        return (
          <ErrorBoundary>
            <Settings />
          </ErrorBoundary>
        )
      default:
        return (
          <ErrorBoundary>
            <PortfolioDashboard />
          </ErrorBoundary>
        )
    }
  }

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
        {renderCurrentPage()}
      </main>
    </ErrorBoundary>
  )
}
