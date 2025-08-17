"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, Lock, Server } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function OnboardingPage() {
  const [hasAccount, setHasAccount] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { session } = useAuth()

  useEffect(() => {
    // Check if user already has a CDP account
    const checkAccount = async () => {
      if (!session) {
        router.push("/login")
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.exists && data.server) {
            // User already has an account, redirect to dashboard
            router.push("/dashboard")
          } else {
            setHasAccount(false)
          }
        } else {
          setHasAccount(false)
        }
      } catch (error) {
        console.error("Error checking account:", error)
        setHasAccount(false)
      }
    }

    checkAccount()
  }, [router, session])

  const handleProvisionAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!session) {
      router.push("/login")
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/cdp/provision`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to provision account")
      }

      // Success - redirect to funding page for new accounts
      router.push("/fund")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (hasAccount === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-foreground font-heading">
            Welcome to DegenGuard!
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Let's create your secure account to start monitoring your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProvisionAccount} className="space-y-4">
            <div className="space-y-4 text-center">
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="flex items-center justify-center mb-3">
                  <Shield className="h-6 w-6 text-primary mr-2" />
                  <h3 className="font-semibold text-foreground">Secure Account Creation</h3>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <Server className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground text-left">
                    Server-managed account using Coinbase Developer Platform for institutional-grade security
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground text-left">
                    Advanced encryption and monitoring to protect your DeFi positions
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Create Secure Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
