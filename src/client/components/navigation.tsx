"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BarChart3, Shield, Bell, History, Settings } from "lucide-react"

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "rules", label: "Rules", icon: Shield, badge: "7" },
  { id: "alerts", label: "Alerts", icon: Bell, badge: "2", badgeVariant: "destructive" as const },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
]

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  return (
    <nav className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {navigationItems.map((item) => {
        const Icon = item.icon
        return (
          <Button
            key={item.id}
            variant={currentPage === item.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onPageChange(item.id)}
            className={cn(
              "flex items-center gap-2 relative",
              currentPage === item.id && "bg-primary text-primary-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
            {item.badge && (
              <Badge variant={item.badgeVariant || "secondary"} className="ml-1 h-5 min-w-5 text-xs px-1 py-0">
                {item.badge}
              </Badge>
            )}
          </Button>
        )
      })}
    </nav>
  )
}
