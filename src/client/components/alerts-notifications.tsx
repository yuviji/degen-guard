"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import {
  Bell,
  AlertTriangle,
  Info,
  Clock,
  Search,
  Settings,
  Eye,
  Check,
  AlarmClockIcon as Snooze,
  TrendingDown,
  Shield,
  DollarSign,
  RefreshCw,
} from "lucide-react"
import { alertsApi, Alert as ApiAlert, ApiError } from "@/lib/api"
import { Navigation } from "@/components/navigation"

interface Alert {
  id: string
  ruleId: string
  ruleName?: string
  ruleDescription?: string
  message: string
  severity: "low" | "medium" | "high"
  acknowledged: boolean
  createdAt: Date
  details?: {
    metric: string
    currentValue: number
    threshold: number
    portfolioValue?: number
  }
}

// Transform API alert to local alert format
function transformApiAlert(apiAlert: ApiAlert): Alert {
  return {
    id: apiAlert.id,
    ruleId: apiAlert.rule_id,
    ruleName: apiAlert.rule_name,
    ruleDescription: apiAlert.rule_description,
    message: apiAlert.message,
    severity: apiAlert.severity,
    acknowledged: apiAlert.acknowledged,
    createdAt: new Date(apiAlert.created_at)
  }
}

interface NotificationSettings {
  email: boolean
  push: boolean
  sms: boolean
  severityFilter: "all" | "medium" | "high"
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
}

// Generate mock analytics data based on alerts
function generateAnalyticsData(alerts: Alert[]) {
  const alertStats = [
    { name: "Mon", high: 0, medium: 0, low: 0 },
    { name: "Tue", high: 0, medium: 0, low: 0 },
    { name: "Wed", high: 0, medium: 0, low: 0 },
    { name: "Thu", high: 0, medium: 0, low: 0 },
    { name: "Fri", high: 0, medium: 0, low: 0 },
    { name: "Sat", high: 0, medium: 0, low: 0 },
    { name: "Sun", high: 0, medium: 0, low: 0 },
  ]
  
  const severityCount = { high: 0, medium: 0, low: 0 }
  
  alerts.forEach(alert => {
    const dayIndex = alert.createdAt.getDay()
    if (dayIndex >= 0 && dayIndex < 7) {
      alertStats[dayIndex][alert.severity]++
    }
    severityCount[alert.severity]++
  })
  
  const severityDistribution = [
    { name: "High", value: severityCount.high, color: "hsl(var(--chart-4))" },
    { name: "Medium", value: severityCount.medium, color: "hsl(var(--chart-2))" },
    { name: "Low", value: severityCount.low, color: "hsl(var(--chart-3))" },
  ]
  
  return { alertStats, severityDistribution }
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function AlertsNotifications() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertStats, setAlertStats] = useState<any[]>([])
  const [severityDistribution, setSeverityDistribution] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [currentPage, setCurrentPage] = useState("alerts")
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email: true,
    push: true,
    sms: false,
    severityFilter: "medium",
    quietHours: {
      enabled: true,
      start: "22:00",
      end: "08:00",
    },
  })

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiAlerts = await alertsApi.getAll()
      const transformedAlerts = apiAlerts.map(transformApiAlert)
      setAlerts(transformedAlerts)
      
      // Generate analytics data
      const analytics = generateAnalyticsData(transformedAlerts)
      setAlertStats(analytics.alertStats)
      setSeverityDistribution(analytics.severityDistribution)
    } catch (err) {
      console.error('Error fetching alerts:', err)
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load alerts')
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.ruleName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "unread" && !alert.acknowledged) ||
      (statusFilter === "read" && alert.acknowledged)

    return matchesSearch && matchesSeverity && matchesStatus
  })

  const unacknowledgedCount = alerts.filter((alert) => !alert.acknowledged).length
  const highSeverityCount = alerts.filter((alert) => alert.severity === "high" && !alert.acknowledged).length

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-chart-4" />
      case "medium":
        return <TrendingDown className="h-4 w-4 text-chart-2" />
      default:
        return <Info className="h-4 w-4 text-chart-3" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "border-l-chart-4 bg-chart-4/5"
      case "medium":
        return "border-l-chart-2 bg-chart-2/5"
      default:
        return "border-l-chart-3 bg-chart-3/5"
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await alertsApi.acknowledge(alertId)
      setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert)))
    } catch (err) {
      console.error('Error acknowledging alert:', err)
    }
  }

  const acknowledgeAll = async () => {
    try {
      await alertsApi.acknowledgeAll()
      setAlerts((prev) => prev.map((alert) => ({ ...alert, acknowledged: true })))
    } catch (err) {
      console.error('Error acknowledging all alerts:', err)
    }
  }

  const snoozeAlert = (alertId: string) => {
    // In a real app, this would set a snooze timestamp
    console.log(`Snoozed alert ${alertId}`)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading alerts...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-destructive">Connection Error</CardTitle>
              <p className="text-muted-foreground">{error}</p>
            </CardHeader>
            <CardContent className="text-center">
              <Button size="lg" className="w-full" onClick={fetchAlerts}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Navigation */}
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts & Notifications</h1>
          <p className="text-muted-foreground">Monitor and manage your portfolio alerts</p>
        </div>
        <div className="flex items-center gap-3">
          {unacknowledgedCount > 0 && (
            <Button onClick={acknowledgeAll} variant="outline" size="sm">
              <Check className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>
          )}
          <Button onClick={fetchAlerts} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowSettings(true)} variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unacknowledgedCount}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">{highSeverityCount}</div>
            <p className="text-xs text-muted-foreground">Critical alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-chart-3">Loading...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.filter(a => new Date().getTime() - a.createdAt.getTime() < 24 * 60 * 60 * 1000).length}</div>
            <p className="text-xs text-muted-foreground">New alerts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="alerts">Alert Timeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Alert Timeline */}
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <Card key={alert.id} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getSeverityIcon(alert.severity)}
                        <h4 className="font-medium">{alert.ruleName || 'Alert'}</h4>
                        <Badge variant={alert.acknowledged ? "secondary" : "default"} className="text-xs">
                          {alert.acknowledged ? "Read" : "Unread"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            alert.severity === "high"
                              ? "border-chart-4 text-chart-4"
                              : alert.severity === "medium"
                                ? "border-chart-2 text-chart-2"
                                : "border-chart-3 text-chart-3"
                          }`}
                        >
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground mb-2">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">{alert.ruleDescription || 'No description available'}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(alert.createdAt)}
                        </span>
                        {alert.details && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Current: {alert.details.currentValue}
                            {alert.details.metric.includes("pct") ? "%" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!alert.acknowledged && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => snoozeAlert(alert.id)}>
                            <Snooze className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => acknowledgeAlert(alert.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Alert Frequency Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Frequency (Last 7 Days)</CardTitle>
                <p className="text-sm text-muted-foreground">Daily alert breakdown by severity</p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={alertStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="high" stackId="a" fill="hsl(var(--chart-4))" />
                      <Bar dataKey="medium" stackId="a" fill="hsl(var(--chart-2))" />
                      <Bar dataKey="low" stackId="a" fill="hsl(var(--chart-3))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Alert Distribution</CardTitle>
                <p className="text-sm text-muted-foreground">Breakdown by severity level</p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {severityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Alerts"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  {severityDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">{item.name}</span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Alert Details Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert && getSeverityIcon(selectedAlert.severity)}
              {selectedAlert?.ruleName || 'Alert'}
            </DialogTitle>
            <DialogDescription>{selectedAlert?.ruleDescription || 'No description available'}</DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Alert Message</h4>
                <p className="text-sm">{selectedAlert.message}</p>
              </div>
              {selectedAlert.details && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current Value:</span>
                      <div className="font-medium">
                        {selectedAlert.details.currentValue}
                        {selectedAlert.details.metric.includes("pct") ? "%" : ""}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Threshold:</span>
                      <div className="font-medium">
                        {selectedAlert.details.threshold}
                        {selectedAlert.details.metric.includes("pct") ? "%" : ""}
                      </div>
                    </div>
                    {selectedAlert.details.portfolioValue && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Portfolio Value:</span>
                        <div className="font-medium">{formatCurrency(selectedAlert.details.portfolioValue)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                {!selectedAlert.acknowledged && (
                  <Button onClick={() => acknowledgeAlert(selectedAlert.id)}>
                    <Check className="mr-2 h-4 w-4" />
                    Acknowledge
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notification Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>Configure how you receive alerts</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Delivery Methods</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email notifications</span>
                  <Switch
                    checked={notificationSettings.email}
                    onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, email: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Push notifications</span>
                  <Switch
                    checked={notificationSettings.push}
                    onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, push: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">SMS notifications</span>
                  <Switch
                    checked={notificationSettings.sms}
                    onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, sms: checked }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Alert Filtering</h4>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Minimum severity level</label>
                <Select
                  value={notificationSettings.severityFilter}
                  onValueChange={(value: "all" | "medium" | "high") =>
                    setNotificationSettings((prev) => ({ ...prev, severityFilter: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All alerts</SelectItem>
                    <SelectItem value="medium">Medium and High</SelectItem>
                    <SelectItem value="high">High only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Quiet Hours</h4>
                <Switch
                  checked={notificationSettings.quietHours.enabled}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, enabled: checked },
                    }))
                  }
                />
              </div>
              {notificationSettings.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Start time</label>
                    <Input
                      type="time"
                      value={notificationSettings.quietHours.start}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, start: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">End time</label>
                    <Input
                      type="time"
                      value={notificationSettings.quietHours.end}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, end: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowSettings(false)}>Save Settings</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
