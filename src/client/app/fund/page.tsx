"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Loader2, Wallet, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { FundButton } from '@coinbase/onchainkit/fund';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

interface BuyQuoteResponse {
  onramp_url: string
  payment_total: {
    currency: string
    value: string
  }
  purchase_amount: {
    currency: string
    value: string
  }
  coinbase_fee: {
    currency: string
    value: string
  }
  network_fee: {
    currency: string
    value: string
  }
}

interface WalletInfo {
  address: string
  balance: string
  status: string
}

interface WalletResponse {
  exists: boolean
  server?: {
    address: string
    status: string
  }
}

export default function FundPage() {
  const router = useRouter()
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [funded, setFunded] = useState(false)
  const [amount, setAmount] = useState<string>("")
  const [currency, setCurrency] = useState<"USD" | "ETH">("USD")
  const [quote, setQuote] = useState<BuyQuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [secureOnrampUrl, setSecureOnrampUrl] = useState<string | null>(null)

  const { session, loading: authLoading } = useAuth()

  useEffect(() => {
    console.log("🔄 Fund page useEffect triggered, session:", !!session, "authLoading:", authLoading)
    
    // Don't do anything while auth is still loading
    if (authLoading) {
      console.log("⏳ Auth still loading, waiting...")
      return
    }
    
    if (!session) {
      console.log("❌ No session, redirecting to login")
      router.push("/login")
      return
    }

    const fetchWalletInfo = async () => {
      console.log("📡 Fetching wallet info...")
      try {
        const walletRes = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        const walletData: WalletResponse = await walletRes.json()
        console.log("💰 WALLET DATA:", walletData)

        if (walletRes.ok && walletData.exists && walletData.server) {
          // Get balance for this address
          const balanceRes = await fetch(`${API_BASE_URL}/api/cdp/${walletData.server.address}/funding-status`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          
          const balanceData = await balanceRes.json()
          console.log("💰 BALANCE DATA:", balanceData)
          
          // For now, set a default balance - we'll get real balance from funding-status endpoint
          const walletInfo: WalletInfo = {
            address: walletData.server.address,
            status: walletData.server.status,
            balance: balanceData.funded ? "0.001" : "0" // Placeholder until we get real balance
          }
          
          setWalletInfo(walletInfo)
          console.log("✅ Wallet info loaded:", walletInfo)
        } else if (walletRes.ok && !walletData.exists) {
          console.log("⚠️ No wallet exists, user needs to provision one")
          // Redirect to onboarding to create wallet
          router.push("/onboarding")
          return
        }
      } catch (err) {
        console.error("❌ Error fetching wallet:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchWalletInfo()

    // Cleanup function
    return () => {
      console.log("🧹 Fund page cleanup")
    }
  }, [session, authLoading]) // Depend on session and auth loading state

  // Separate useEffect for polling when actively funding
  useEffect(() => {
    if (!session || !walletInfo || !secureOnrampUrl) return

    console.log("🔍 Starting balance polling for active funding...")
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!response.ok) return

        const data = await response.json()
        console.log("🔄 Polling balance:", data.balance, "vs previous:", walletInfo.balance)
        
        if (Number.parseFloat(data.balance) > Number.parseFloat(walletInfo.balance)) {
          console.log("🎉 New funds detected!")
          setFunded(true)
          setWalletInfo(data)
          clearInterval(pollInterval)
          setTimeout(() => router.push("/dashboard"), 2000)
        }
      } catch (err) {
        console.error("❌ Error polling wallet balance:", err)
      }
    }, 5000) // Poll every 5 seconds when actively funding

    return () => {
      console.log("🧹 Cleaning up polling interval")
      clearInterval(pollInterval)
    }
  }, [session, walletInfo, secureOnrampUrl, router])

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (funded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-chart-3 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2 font-heading">Funding Successful!</h2>
            <p className="text-muted-foreground mb-4">Your wallet has been funded successfully.</p>
            <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground font-heading">Fund Your Guardian</CardTitle>
          <CardDescription className="text-muted-foreground">
            Add funds to your secure wallet to start protecting your DeFi positions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {walletInfo && (
            <div className="p-4 bg-muted/20 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Wallet Address</span>
                <Badge variant="outline" className="text-xs border-primary text-primary">
                  <Wallet className="h-4 w-4 mr-1" />
                  Ready to Fund
                </Badge>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">{walletInfo.address}</p>
              <div className="mt-2 flex justify-between">
                <span className="text-sm text-muted-foreground">Current Balance</span>
                <span className="text-sm font-semibold text-foreground metric-value">
                  {Number.parseFloat(walletInfo.balance).toFixed(4)} ETH
                </span>
              </div>
              {Number.parseFloat(walletInfo.balance) > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="w-full py-2 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    You already have funds. Add more below or go to your dashboard.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* Custom Amount Input */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrency("USD")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    currency === "USD"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  USD
                </button>
                <button
                  onClick={() => setCurrency("ETH")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    currency === "ETH"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  ETH
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground">Amount ({currency})</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Enter ${currency} amount`}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                  min="0"
                  step={currency === "USD" ? "1" : "0.001"}
                />
              </div>

              <button
                onClick={async () => {
                  if (!amount || Number.parseFloat(amount) <= 0) return

                  setQuoteLoading(true)
                  try {
                    // Get both quote and session token for secure onramp
                    const [quoteResponse, sessionResponse] = await Promise.all([
                      fetch(`${API_BASE_URL}/api/onramp/buy-quote`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${session?.access_token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          paymentAmount: amount,
                          paymentCurrency: currency === "USD" ? "USD" : "ETH",
                          purchaseCurrency: "ETH",
                          purchaseNetwork: "base",
                          country: "US",
                        }),
                      }),
                      fetch(`${API_BASE_URL}/api/onramp/session-token`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${session?.access_token}`,
                          "Content-Type": "application/json",
                        },
                      })
                    ])

                    const [quoteData, sessionData] = await Promise.all([
                      quoteResponse.json(),
                      sessionResponse.json()
                    ])

                    if (quoteResponse.ok && sessionResponse.ok) {
                      setQuote(quoteData)
                      
                      // Construct secure onramp URL with session token
                      const projectId = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_ID
                      const secureOnrampUrl = `https://pay.coinbase.com/buy/select-asset?` +
                        `appId=${projectId}&` +
                        `addresses=${encodeURIComponent(JSON.stringify([sessionData.destinationAddress]))}&` +
                        `assets=${encodeURIComponent(JSON.stringify(['ETH']))}&` +
                        `sessionToken=${sessionData.sessionToken}&` +
                        `redirectUrl=${encodeURIComponent(window.location.origin + '/dashboard')}`
                      
                      setSecureOnrampUrl(secureOnrampUrl)
                      console.log("✅ Got quote and constructed secure onramp URL", { 
                        destinationAddress: sessionData.destinationAddress,
                        secureUrl: secureOnrampUrl
                      })
                    } else {
                      console.error("Error:", { quoteData, sessionData })
                    }
                  } catch (err) {
                    console.error("Error getting quote:", err)
                  } finally {
                    setQuoteLoading(false)
                  }
                }}
                disabled={!amount || Number.parseFloat(amount) <= 0 || quoteLoading}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {quoteLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  "Get Quote"
                )}
              </button>
            </div>

            {/* Quote Display and Fund Button */}
            {quote && secureOnrampUrl && (
              <div className="bg-muted/20 rounded-lg p-4 space-y-3 border border-border">
                <h3 className="text-foreground font-medium">Quote Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You'll receive:</span>
                    <span className="text-foreground font-medium metric-value">
                      {Number.parseFloat(quote.purchase_amount.value).toFixed(4)} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total cost:</span>
                    <span className="text-foreground font-medium metric-value">
                      ${Number.parseFloat(quote.payment_total.value).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coinbase fee:</span>
                    <span className="text-muted-foreground metric-value">
                      ${Number.parseFloat(quote.coinbase_fee.value).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network fee:</span>
                    <span className="text-muted-foreground metric-value">
                      ${Number.parseFloat(quote.network_fee.value).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Funds will be sent to your secure server wallet
                    </span>
                  </div>
                </div>
                
                {/* OnchainKit Fund Button with secure onramp URL */}
                <FundButton fundingUrl={secureOnrampUrl} />
              </div>
            )}

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Funds will be automatically detected once the transaction is confirmed on the Base network.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
