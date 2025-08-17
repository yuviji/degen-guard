"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
} from "recharts"
import { TrendingUp, CreditCard, Shield, Bell, Clock, ArrowUpRight, ArrowDownRight, ExternalLink, RefreshCw } from "lucide-react"
import { portfolioApi, PortfolioMetrics, ApiError } from "@/lib/api"

// Asset color mapping for consistent visualization
const ASSET_COLORS: Record<string, string> = {
  ETH: "#627EEA",
  USDC: "#2775CA",
  USDT: "#26A17B",
  WBTC: "#F7931A",
  LINK: "#375BD2",
  UNI: "#FF007A",
  DAI: "#F5AC37",
  AAVE: "#B6509E",
  COMP: "#00D395",
  default: "#6B7280"
}

function getAssetColor(symbol: string): string {
  return ASSET_COLORS[symbol] || ASSET_COLORS.default
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

export function PortfolioDashboard() {
  const [portfolioData, setPortfolioData] = useState<PortfolioMetrics | null>(null)
  const [performanceData, setPerformanceData] = useState<Array<{ time: string; value: number }>>([])
  const [recentTransactions, setRecentTransactions] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date>(new Date())
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    fetchPortfolioData()
  }, [])

  const fetchPortfolioData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch portfolio overview
      const overview = await portfolioApi.getOverview()
      setPortfolioData(overview)
      
      // Fetch performance history
      const history = await portfolioApi.getHistory(1) // Last 24 hours
      const formattedHistory = history.map((point, index) => ({
        time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        value: point.total_value
      }))
      setPerformanceData(formattedHistory)
      
      // Fetch recent transactions
      const transactions = await portfolioApi.getTransactions(5)
      setRecentTransactions(transactions)
      
      setLastSync(new Date())
      setIsConnected(true)
    } catch (err) {
      console.error('Error fetching portfolio data:', err)
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load portfolio data')
      }
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  // Transform asset allocations for visualization
  const assetAllocation = portfolioData?.asset_allocations.map(asset => ({
    symbol: asset.symbol,
    allocation: asset.allocation_pct,
    value: asset.usd_value,
    color: getAssetColor(asset.symbol)
  })) || []

  // Calculate daily change in USD
  const dailyChangeUsd = portfolioData ? 
    (portfolioData.total_usd_value * portfolioData.daily_pnl_pct) / 100 : 0

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading portfolio data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !portfolioData) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-destructive">Connection Error</CardTitle>
              <p className="text-muted-foreground">
                {error || 'Failed to load portfolio data. Please check your connection and try again.'}
              </p>
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" className="w-full" onClick={fetchPortfolioData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!isConnected || portfolioData.total_usd_value > 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Fund Your Guardian</CardTitle>
              <p className="text-muted-foreground">Add crypto to your secure account to start monitoring your DeFi portfolio</p>
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" className="w-full" onClick={() => window.location.href = '/fund'}>
                <CreditCard className="mr-2 h-4 w-4" />
                Fund Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DegenGuard</h1>
          <p className="text-muted-foreground">AI-powered DeFi portfolio monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            <Clock className="mr-1 h-3 w-3" />
            Last sync: {formatTimeAgo(lastSync)}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchPortfolioData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Portfolio Value Card - Large and Prominent */}
      <Card className="bg-gradient-to-r from-card to-card/80 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Total Portfolio Value</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold metric-value">{formatCurrency(portfolioData.total_usd_value)}</span>
                <div
                  className={`flex items-center gap-1 ${portfolioData.daily_pnl_pct >= 0 ? "text-chart-3" : "text-chart-4"}`}
                >
                  {portfolioData.daily_pnl_pct >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  <span className="text-lg font-semibold">{formatPercentage(portfolioData.daily_pnl_pct)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({formatCurrency(dailyChangeUsd)})
                  </span>
                </div>
              </div>
            </div>
            <div className="w-32 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#valueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stablecoin Allocation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold metric-value">{portfolioData.stablecoin_allocation_pct.toFixed(1)}%</div>
            <div className="mt-2">
              <Progress value={portfolioData.stablecoin_allocation_pct} className="h-2" />
            </div>
            <p
              className={`text-xs mt-1 ${portfolioData.stablecoin_allocation_pct < 30 ? "text-chart-4" : "text-muted-foreground"}`}
            >
              {portfolioData.stablecoin_allocation_pct < 30 ? "Below recommended 30%" : "Healthy allocation"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold metric-value">-</div>
            <p className="text-xs text-muted-foreground">Loading account data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold metric-value">-</div>
            <p className="text-xs text-chart-3">Loading rules data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold metric-value">-</div>
            <p className="text-xs text-chart-2">Loading alerts data</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Asset Allocation Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <p className="text-sm text-muted-foreground">Portfolio breakdown by token</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="allocation"
                    >
                      {assetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, "Allocation"]}
                      labelFormatter={(label) => `${label}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {assetAllocation.map((asset) => (
                  <div key={asset.symbol} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
                      <span className="font-medium">{asset.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold metric-value">{formatCurrency(asset.value)}</div>
                      <div className="text-sm text-muted-foreground">{asset.allocation}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <p className="text-sm text-muted-foreground">Latest transactions</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx, index) => (
                  <div key={tx.id || index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-2 h-2 rounded-full mt-2 bg-chart-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {tx.event_type || 'Transaction'}: {tx.transaction_hash?.slice(0, 10)}...
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(new Date(tx.timestamp))}
                        </span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {tx.chain || 'ethereum'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold metric-value">
                          {tx.usd_value ? formatCurrency(parseFloat(tx.usd_value)) : '-'}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent transactions found</p>
                  <p className="text-xs mt-1">Transaction data will appear here once available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>24h Performance</CardTitle>
          <p className="text-sm text-muted-foreground">Portfolio value over time</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Portfolio Value"]}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
