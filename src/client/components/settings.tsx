"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  SettingsIcon,
  Wallet,
  Bell,
  Shield,
  User,
  Trash2,
  Plus,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Download,
} from "lucide-react"

interface UserSettings {
  profile: {
    name: string
    email: string
    timezone: string
    currency: string
  }
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
    quietHours: {
      enabled: boolean
      start: string
      end: string
    }
    severityFilter: "all" | "medium" | "high"
  }
  security: {
    twoFactorEnabled: boolean
    sessionTimeout: number
    apiKeyVisible: boolean
  }
  preferences: {
    theme: "dark" | "light" | "system"
    defaultView: "dashboard" | "rules" | "alerts" | "history"
    autoRefresh: boolean
    refreshInterval: number
  }
}

interface ConnectedWallet {
  id: string
  address: string
  label: string
  chain: string
  balance: string
  lastSync: Date
  isActive: boolean
}

const mockWallets: ConnectedWallet[] = [
  {
    id: "1",
    address: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    label: "Main Wallet",
    chain: "ethereum",
    balance: "127,543.82",
    lastSync: new Date(Date.now() - 2 * 60 * 1000),
    isActive: true,
  },
  {
    id: "2",
    address: "0x2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u",
    label: "DeFi Wallet",
    chain: "ethereum",
    balance: "45,231.67",
    lastSync: new Date(Date.now() - 5 * 60 * 1000),
    isActive: true,
  },
  {
    id: "3",
    address: "0x3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v",
    label: "Polygon Wallet",
    chain: "polygon",
    balance: "12,890.45",
    lastSync: new Date(Date.now() - 10 * 60 * 1000),
    isActive: false,
  },
]

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  return `${Math.floor(diffMins / 60)}h ago`
}

export function Settings() {
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      name: "DeFi Trader",
      email: "trader@example.com",
      timezone: "UTC-5",
      currency: "USD",
    },
    notifications: {
      email: true,
      push: true,
      sms: false,
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00",
      },
      severityFilter: "medium",
    },
    security: {
      twoFactorEnabled: true,
      sessionTimeout: 30,
      apiKeyVisible: false,
    },
    preferences: {
      theme: "dark",
      defaultView: "dashboard",
      autoRefresh: true,
      refreshInterval: 30,
    },
  })

  const [wallets, setWallets] = useState<ConnectedWallet[]>(mockWallets)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)

  const updateSettings = (section: keyof UserSettings, updates: Partial<UserSettings[keyof UserSettings]>) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleWallet = (walletId: string) => {
    setWallets((prev) =>
      prev.map((wallet) => (wallet.id === walletId ? { ...wallet, isActive: !wallet.isActive } : wallet)),
    )
  }

  const deleteWallet = (walletId: string) => {
    setWallets((prev) => prev.filter((wallet) => wallet.id !== walletId))
    setShowDeleteDialog(null)
  }

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "degenguard-settings.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={exportSettings} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="wallets" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <p className="text-sm text-muted-foreground">Update your personal information and preferences</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={settings.profile.name}
                    onChange={(e) => updateSettings("profile", { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => updateSettings("profile", { email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.profile.timezone}
                    onValueChange={(value) => updateSettings("profile", { timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC-8">Pacific Time (UTC-8)</SelectItem>
                      <SelectItem value="UTC-5">Eastern Time (UTC-5)</SelectItem>
                      <SelectItem value="UTC+0">UTC</SelectItem>
                      <SelectItem value="UTC+1">Central European Time (UTC+1)</SelectItem>
                      <SelectItem value="UTC+8">Singapore Time (UTC+8)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select
                    value={settings.profile.currency}
                    onValueChange={(value) => updateSettings("profile", { currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallets" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connected Wallets</CardTitle>
                  <p className="text-sm text-muted-foreground">Manage your connected cryptocurrency wallets</p>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Wallet
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {wallets.map((wallet) => (
                  <div key={wallet.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={wallet.isActive} onCheckedChange={() => toggleWallet(wallet.id)} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{wallet.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {wallet.chain}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-mono">{truncateAddress(wallet.address)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0"
                              onClick={() => copyToClipboard(wallet.address)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${wallet.balance}</div>
                        <div className="text-xs text-muted-foreground">Last sync: {formatTimeAgo(wallet.lastSync)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Dialog open={showDeleteDialog === wallet.id} onOpenChange={() => setShowDeleteDialog(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDeleteDialog(wallet.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Remove Wallet</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to remove "{wallet.label}"? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={() => deleteWallet(wallet.id)}>
                              Remove Wallet
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <p className="text-sm text-muted-foreground">Configure how you receive alerts and updates</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Delivery Methods</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Email Notifications</span>
                      <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                    </div>
                    <Switch
                      checked={settings.notifications.email}
                      onCheckedChange={(checked) => updateSettings("notifications", { email: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Push Notifications</span>
                      <p className="text-sm text-muted-foreground">Browser push notifications</p>
                    </div>
                    <Switch
                      checked={settings.notifications.push}
                      onCheckedChange={(checked) => updateSettings("notifications", { push: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">SMS Notifications</span>
                      <p className="text-sm text-muted-foreground">Text message alerts</p>
                    </div>
                    <Switch
                      checked={settings.notifications.sms}
                      onCheckedChange={(checked) => updateSettings("notifications", { sms: checked })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Alert Filtering</h4>
                <div className="space-y-2">
                  <Label>Minimum Severity Level</Label>
                  <Select
                    value={settings.notifications.severityFilter}
                    onValueChange={(value: "all" | "medium" | "high") =>
                      updateSettings("notifications", { severityFilter: value })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Alerts</SelectItem>
                      <SelectItem value="medium">Medium and High</SelectItem>
                      <SelectItem value="high">High Priority Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Quiet Hours</span>
                    <p className="text-sm text-muted-foreground">Disable notifications during specified hours</p>
                  </div>
                  <Switch
                    checked={settings.notifications.quietHours.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings("notifications", {
                        quietHours: { ...settings.notifications.quietHours, enabled: checked },
                      })
                    }
                  />
                </div>
                {settings.notifications.quietHours.enabled && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={settings.notifications.quietHours.start}
                        onChange={(e) =>
                          updateSettings("notifications", {
                            quietHours: { ...settings.notifications.quietHours, start: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={settings.notifications.quietHours.end}
                        onChange={(e) =>
                          updateSettings("notifications", {
                            quietHours: { ...settings.notifications.quietHours, end: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <p className="text-sm text-muted-foreground">Manage your account security and access controls</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Two-Factor Authentication</span>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={settings.security.twoFactorEnabled ? "default" : "secondary"}>
                    {settings.security.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Switch
                    checked={settings.security.twoFactorEnabled}
                    onCheckedChange={(checked) => updateSettings("security", { twoFactorEnabled: checked })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Select
                  value={settings.security.sessionTimeout.toString()}
                  onValueChange={(value) => updateSettings("security", { sessionTimeout: Number.parseInt(value) })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">API Access</h4>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={settings.security.apiKeyVisible ? "text" : "password"}
                      value="dg_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p"
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateSettings("security", { apiKeyVisible: !settings.security.apiKeyVisible })}
                    >
                      {settings.security.apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("dg_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this key to access the DegenGuard API programmatically
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Regenerate API Key
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <p className="text-sm text-muted-foreground">Customize your DegenGuard experience</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={settings.preferences.theme}
                    onValueChange={(value: "dark" | "light" | "system") =>
                      updateSettings("preferences", { theme: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default View</Label>
                  <Select
                    value={settings.preferences.defaultView}
                    onValueChange={(value: "dashboard" | "rules" | "alerts" | "history") =>
                      updateSettings("preferences", { defaultView: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">Dashboard</SelectItem>
                      <SelectItem value="rules">Rules</SelectItem>
                      <SelectItem value="alerts">Alerts</SelectItem>
                      <SelectItem value="history">History</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Auto Refresh</span>
                    <p className="text-sm text-muted-foreground">Automatically refresh data at regular intervals</p>
                  </div>
                  <Switch
                    checked={settings.preferences.autoRefresh}
                    onCheckedChange={(checked) => updateSettings("preferences", { autoRefresh: checked })}
                  />
                </div>

                {settings.preferences.autoRefresh && (
                  <div className="space-y-2 ml-6">
                    <Label>Refresh Interval</Label>
                    <Select
                      value={settings.preferences.refreshInterval.toString()}
                      onValueChange={(value) =>
                        updateSettings("preferences", { refreshInterval: Number.parseInt(value) })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
