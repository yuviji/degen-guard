"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Send,
  Bot,
  User,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Code,
  Shield,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react"
import { rulesApi, Rule as ApiRule, ApiError } from "@/lib/api"

interface Rule {
  id: string
  name: string
  description: string
  naturalLanguage?: string
  isActive: boolean
  createdAt: Date
  lastTriggered?: Date
  triggerCount: number
  ruleJson: {
    triggers: Array<{
      metric: string
      operator: string
      value: number
      timeframe?: string
    }>
    actions: Array<{
      type: string
      config: Record<string, any>
    }>
  }
}

interface ChatMessage {
  id: string
  type: "user" | "bot"
  content: string
  timestamp: Date
  rulePreview?: Rule
}

// Transform API rule to local rule format
function transformApiRule(apiRule: ApiRule): Rule {
  return {
    id: apiRule.id,
    name: apiRule.name,
    description: apiRule.description,
    isActive: apiRule.is_active,
    createdAt: new Date(apiRule.created_at),
    triggerCount: 0, // Would need to fetch from evaluations
    ruleJson: apiRule.rule_json
  }
}

const examplePrompts = [
  "Alert me if daily PnL drops below -5%",
  "Notify when portfolio value exceeds $100k",
  "Warn if stablecoin allocation is below 30%",
  "Alert when any position is over 50% of portfolio",
]

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

export function RulesManagement() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "bot",
      content:
        "Hi! I'm your AI assistant. Describe the monitoring rule you'd like to create in plain English, and I'll help you set it up.",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [showJsonView, setShowJsonView] = useState(false)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiRules = await rulesApi.getAll()
      const transformedRules = apiRules.map(transformApiRule)
      setRules(transformedRules)
    } catch (err) {
      console.error('Error fetching rules:', err)
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load rules')
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredRules = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    const originalMessage = inputMessage
    setInputMessage("")
    setIsTyping(true)

    try {
      // Call the API to create rule from natural language
      const newApiRule = await rulesApi.createFromLanguage(originalMessage)
      const newRule = transformApiRule(newApiRule)
      
      setRules((prev) => [newRule, ...prev])
      
      const botResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: `Great! I've created your rule: "${newRule.name}". It's now active and monitoring your portfolio.`,
        timestamp: new Date(),
      }
      
      setChatMessages((prev) => [...prev, botResponse])
    } catch (err) {
      console.error('Error creating rule:', err)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: `Sorry, I couldn't create that rule. ${err instanceof ApiError ? err.message : 'Please try again with a different description.'}`,
        timestamp: new Date(),
      }
      setChatMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleCreateRule = async (rulePreview: Rule) => {
    try {
      const newApiRule = await rulesApi.createFromLanguage(rulePreview.description || '')
      const newRule = transformApiRule(newApiRule)
      setRules((prev) => [newRule, ...prev])
      
      const confirmMessage: ChatMessage = {
        id: Date.now().toString(),
        type: "bot",
        content: "Great! Your rule has been created and is now active. You can manage it in the rules panel.",
        timestamp: new Date(),
      }
      setChatMessages((prev) => [...prev, confirmMessage])
    } catch (err) {
      console.error('Error creating rule:', err)
    }
  }

  const toggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return
    
    try {
      await rulesApi.updateStatus(ruleId, !rule.isActive)
      setRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule)))
    } catch (err) {
      console.error('Error toggling rule:', err)
    }
  }

  const deleteRule = async (ruleId: string) => {
    try {
      await rulesApi.delete(ruleId)
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
    } catch (err) {
      console.error('Error deleting rule:', err)
    }
  }

  const getSeverityIcon = (actions: any[]) => {
    const severity = actions[0]?.config?.severity || 'low'
    switch (severity) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-chart-4" />
      case "medium":
        return <TrendingDown className="h-4 w-4 text-chart-2" />
      default:
        return <CheckCircle className="h-4 w-4 text-chart-3" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading rules...</p>
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
              <Button size="lg" className="w-full" onClick={fetchRules}>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rules Management</h1>
          <p className="text-muted-foreground">Create and manage AI-powered monitoring rules</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{rules.filter((r) => r.isActive).length} Active Rules</Badge>
          <Badge variant="outline">{rules.length} Total Rules</Badge>
          <Button variant="outline" size="sm" onClick={fetchRules}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Panel - AI Chat Interface */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Rule Builder
            </CardTitle>
            <p className="text-sm text-muted-foreground">Describe your monitoring rule in plain English</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {chatMessages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.type === "user" ? "justify-end" : ""}`}>
                  {message.type === "bot" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.type === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.rulePreview && (
                      <div className="mt-3 p-3 bg-card rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">Rule Preview</h4>
                          <Button size="sm" onClick={() => handleCreateRule(message.rulePreview!)}>
                            Create Rule
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{message.rulePreview.description}</p>
                      </div>
                    )}
                  </div>
                  {message.type === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Example Prompts */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 bg-transparent"
                    onClick={() => setInputMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Describe your monitoring rule..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} disabled={!inputMessage.trim() || isTyping}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Active Rules */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Active Rules
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {filteredRules.map((rule) => (
                <Card key={rule.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.isActive} onCheckedChange={() => toggleRule(rule.id)} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedRule(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowJsonView(true)}>
                            <Code className="mr-2 h-4 w-4" />
                            View JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteRule(rule.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {formatTimeAgo(rule.createdAt)}
                      </span>
                      {rule.lastTriggered && (
                        <span className="flex items-center gap-1">
                          {getSeverityIcon(rule.ruleJson.actions)}
                          Last triggered {formatTimeAgo(rule.lastTriggered)}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {rule.triggerCount} triggers
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* JSON View Dialog */}
      <Dialog open={showJsonView} onOpenChange={setShowJsonView}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rule JSON Configuration</DialogTitle>
            <DialogDescription>Technical view of the rule configuration</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              value={JSON.stringify(selectedRule?.ruleJson || {}, null, 2)}
              readOnly
              className="font-mono text-sm h-64"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
