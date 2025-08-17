"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Loader2, Wallet } from "lucide-react"
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

export default function FundPage() {
  const router = useRouter()
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [funded, setFunded] = useState(false)
  const [amount, setAmount] = useState<string>("")
  const [currency, setCurrency] = useState<"USD" | "ETH">("USD")
  const [quote, setQuote] = useState<BuyQuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [fundingUrl, setFundingUrl] = useState<string | null>(null)

  const { session } = useAuth()

  useEffect(() => {
    if (!session) {
      router.push("/login")
      return
    }

    const fetchWalletInfo = async () => {
      try {
        const walletRes = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        const walletData = await walletRes.json()
        console.log("WALLET DATA:", walletData)

        if (walletRes.ok && walletData.address) {
          setWalletInfo(walletData)
          if (Number.parseFloat(walletData.balance) > 0) {
            setFunded(true)
            setTimeout(() => router.push("/dashboard"), 2000)
          }
        }
      } catch (err) {
        console.error("Error fetching wallet:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchWalletInfo()

    const pollForFunding = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cdp/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!response.ok) return

        const data = await response.json()
        if (Number.parseFloat(data.balance) > 0 && !funded) {
          setFunded(true)
          setWalletInfo(data)
          clearInterval(pollInterval)
          setTimeout(() => router.push("/dashboard"), 2000)
        }
      } catch (err) {
        console.error("Error polling wallet balance:", err)
      }
    }

    const pollInterval = setInterval(pollForFunding, 10000)

    // Cleanup polling on unmount
    return () => clearInterval(pollInterval)
  }, [router, funded])

  if (loading) {
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
                    const response = await fetch(`${API_BASE_URL}/api/onramp/buy-quote`, {
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
                    })

                    const data = await response.json()
                    if (response.ok) {
                      setQuote(data)
                      setFundingUrl(data.onramp_url)
                    } else {
                      console.error("Quote error:", data)
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

            {/* Quote Display */}
            {quote && (
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
                </div>
                <FundButton fundingUrl={quote.onramp_url + "&redirectUrl=" + API_BASE_URL} />
              </div>
            )}

            {/* Fund Button */}
            {fundingUrl && <FundButton fundingUrl={fundingUrl} />}

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
