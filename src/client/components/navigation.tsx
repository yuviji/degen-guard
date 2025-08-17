"use client"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BarChart3, Shield, Bell, History } from "lucide-react"

interface NavigationProps {
  currentPage: string
  onPageChange: (page: string) => void
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/dashboard" },
  { id: "rules", label: "Rules", icon: Shield, badge: "7", path: "/rules" },
  { id: "alerts", label: "Alerts", icon: Bell, badge: "2", badgeVariant: "destructive" as const, path: "/alerts" },
  { id: "history", label: "History", icon: History, path: "/history" },
]

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleNavigation = (item: typeof navigationItems[0]) => {
    router.push(item.path)
    onPageChange(item.id)
  }

  const getCurrentPageFromPath = () => {
    const currentItem = navigationItems.find(item => pathname === item.path)
    return currentItem?.id || currentPage
  }

  const activePageId = getCurrentPageFromPath()

  return (
    <nav className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {navigationItems.map((item) => {
        const Icon = item.icon
        return (
          <Button
            key={item.id}
            variant={activePageId === item.id ? "default" : "ghost"}
            size="sm"
            onClick={() => handleNavigation(item)}
            className={cn(
              "flex items-center gap-2 relative",
              activePageId === item.id && "bg-primary text-primary-foreground",
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
