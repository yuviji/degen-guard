"use client";
import { AuthGuard } from '@/components/auth-guard';
import { PortfolioDashboard } from '@/components/portfolio-dashboard';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <PortfolioDashboard />
    </AuthGuard>
  );
}
