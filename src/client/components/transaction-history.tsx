"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Filter,
  Download,
  ExternalLink,
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Repeat,
  Plus,
  Minus,
  MoreHorizontal,
  Copy,
  Eye,
} from "lucide-react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

interface Transaction {
  id: string
  walletId: string
  transactionHash: string
  blockNumber: number
  eventType: "transfer" | "swap" | "deposit" | "withdrawal"
  fromAddress: string
  toAddress: string
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  amount: string
  usdValue: string
  gasUsed: string
  gasFee: string
  timestamp: Date
  walletAddress: string
  chain: "ethereum" | "polygon" | "arbitrum" | "optimism"
  walletLabel: string
  status: "confirmed" | "pending" | "failed"
}

// Mock transaction data
const mockTransactions: Transaction[] = [
  {
    id: "1",
    walletId: "wallet-1",
    transactionHash: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f",
    blockNumber: 18500123,
    eventType: "swap",
    fromAddress: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
    toAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    tokenAddress: "0xA0b86a33E6441b8C4C4C4C4C4C4C4C4C4C4C4C4C",
    tokenSymbol: "ETH",
    tokenName: "Ethereum",
    amount: "2.5",
    usdValue: "4832.50",
    gasUsed: "21000",
    gasFee: "0.0045",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    walletAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    chain: "ethereum",
    walletLabel: "Main Wallet",
    status: "confirmed",
  },
  {
    id: "2",
    walletId: "wallet-1",
    transactionHash: "0x2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g",
    blockNumber: 18500089,
    eventType: "transfer",
    fromAddress: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
    toAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    tokenSymbol: "WBTC",
    tokenName: "Wrapped Bitcoin",
    amount: "0.8",
    usdValue: "32100.00",
    gasUsed: "21000",
    gasFee: "0.0032",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    walletAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    chain: "ethereum",
    walletLabel: "Main Wallet",
    status: "confirmed",
  },
  {
    id: "3",
    walletId: "wallet-2",
    transactionHash: "0x3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h",
    blockNumber: 18499876,
    eventType: "deposit",
    fromAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    toAddress: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    tokenAddress: "0xA0b86a33E6441b8C4C4C4C4C4C4C4C4C4C4C4C4C",
    tokenSymbol: "USDC",
    tokenName: "USD Coin",
    amount: "1000.00",
    usdValue: "1000.00",
    gasUsed: "45000",
    gasFee: "0.0078",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    walletAddress: "0x2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u",
    chain: "ethereum",
    walletLabel: "DeFi Wallet",
    status: "confirmed",
  },
  {
    id: "4",
    walletId: "wallet-1",
    transactionHash: "0x4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i",
    blockNumber: 18499654,
    eventType: "withdrawal",
    fromAddress: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    toAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    tokenAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    tokenSymbol: "LINK",
    tokenName: "Chainlink",
    amount: "500.00",
    usdValue: "7250.00",
    gasUsed: "35000",
    gasFee: "0.0056",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    walletAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    chain: "ethereum",
    walletLabel: "Main Wallet",
    status: "confirmed",
  },
  {
    id: "5",
    walletId: "wallet-3",
    transactionHash: "0x5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j",
    blockNumber: 45123456,
    eventType: "swap",
    fromAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    toAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    tokenAddress: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
    tokenSymbol: "MATIC",
    tokenName: "Polygon",
    amount: "2500.00",
    usdValue: "1875.00",
    gasUsed: "21000",
    gasFee: "0.025",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    walletAddress: "0x3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v",
    chain: "polygon",
    walletLabel: "Polygon Wallet",
    status: "confirmed",
  },
  {
    id: "6",
    walletId: "wallet-1",
    transactionHash: "0x6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k",
    blockNumber: 18499321,
    eventType: "transfer",
    fromAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    toAddress: "0x742d35Cc6634C0532925a3b8D4C9db4C4C4C4C4C",
    tokenAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    tokenSymbol: "UNI",
    tokenName: "Uniswap",
    amount: "150.00",
    usdValue: "1050.00",
    gasUsed: "21000",
    gasFee: "0.0041",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    walletAddress: "0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
    chain: "ethereum",
    walletLabel: "Main Wallet",
    status: "confirmed",
  },
]

type SortField = "timestamp" | "usdValue" | "tokenSymbol" | "eventType"
type SortDirection = "asc" | "desc"

function formatCurrency(value: string | number): string {
  const numValue = typeof value === "string" ? Number.parseFloat(value) : value
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue)
}

function formatTokenAmount(amount: string, symbol: string): string {
  const numAmount = Number.parseFloat(amount)
  return `${numAmount.toLocaleString()} ${symbol}`
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

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function getChainExplorerUrl(chain: string, hash: string): string {
  const explorers = {
    ethereum: "https://etherscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
    arbitrum: "https://arbiscan.io/tx/",
    optimism: "https://optimistic.etherscan.io/tx/",
  }
  return `${explorers[chain as keyof typeof explorers]}${hash}`
}

function getEventTypeIcon(eventType: string) {
  switch (eventType) {
    case "swap":
      return <RefreshCw className="h-4 w-4 text-chart-1" />
    case "transfer":
      return <ArrowUpDown className="h-4 w-4 text-chart-3" />
    case "deposit":
      return <Plus className="h-4 w-4 text-chart-3" />
    case "withdrawal":
      return <Minus className="h-4 w-4 text-chart-4" />
    default:
      return <Repeat className="h-4 w-4 text-muted-foreground" />
  }
}

function getChainBadgeColor(chain: string) {
  switch (chain) {
    case "ethereum":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "polygon":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20"
    case "arbitrum":
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
    case "optimism":
      return "bg-red-500/10 text-red-500 border-red-500/20"
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20"
  }
}

export function TransactionHistory() {
  const [transactions] = useState<Transaction[]>(mockTransactions)
  const [searchQuery, setSearchQuery] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  const [chainFilter, setChainFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [sortField, setSortField] = useState<SortField>("timestamp")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filteredAndSortedTransactions = useMemo(() => {
    const filtered = transactions.filter((tx) => {
      const matchesSearch =
        tx.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.transactionHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.walletLabel.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesEventType = eventTypeFilter === "all" || tx.eventType === eventTypeFilter
      const matchesChain = chainFilter === "all" || tx.chain === chainFilter

      const matchesDateRange =
        (!dateRange.from || tx.timestamp >= startOfDay(dateRange.from)) &&
        (!dateRange.to || tx.timestamp <= endOfDay(dateRange.to))

      return matchesSearch && matchesEventType && matchesChain && matchesDateRange
    })

    // Sort transactions
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (sortField === "usdValue") {
        aValue = Number.parseFloat(a.usdValue)
        bValue = Number.parseFloat(b.usdValue)
      } else if (sortField === "timestamp") {
        aValue = a.timestamp.getTime()
        bValue = b.timestamp.getTime()
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [transactions, searchQuery, eventTypeFilter, chainFilter, dateRange, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const exportToCSV = () => {
    const headers = ["Date", "Type", "Token", "Amount", "USD Value", "Chain", "Wallet", "Transaction Hash", "Gas Fee"]

    const csvData = filteredAndSortedTransactions.map((tx) => [
      format(tx.timestamp, "yyyy-MM-dd HH:mm:ss"),
      tx.eventType,
      tx.tokenSymbol,
      tx.amount,
      tx.usdValue,
      tx.chain,
      tx.walletLabel,
      tx.transactionHash,
      tx.gasFee,
    ])

    const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `degenguard-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const totalValue = filteredAndSortedTransactions.reduce((sum, tx) => sum + Number.parseFloat(tx.usdValue), 0)
  const totalGasFees = filteredAndSortedTransactions.reduce((sum, tx) => sum + Number.parseFloat(tx.gasFee), 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground">Complete record of your DeFi transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAndSortedTransactions.length}</div>
            <p className="text-xs text-muted-foreground">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">Transaction value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gas Fees Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGasFees.toFixed(4)} ETH</div>
            <p className="text-xs text-muted-foreground">Total gas costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(filteredAndSortedTransactions.map((tx) => tx.chain)).size}
            </div>
            <p className="text-xs text-muted-foreground">Networks used</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Transaction Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="swap">Swaps</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                  <SelectItem value="deposit">Deposits</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                </SelectContent>
              </Select>

              <Select value={chainFilter} onValueChange={setChainFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="optimism">Optimism</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      "Pick a date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setEventTypeFilter("all")
                  setChainFilter("all")
                  setDateRange({ from: subDays(new Date(), 30), to: new Date() })
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 p-0 font-medium"
                      onClick={() => handleSort("timestamp")}
                    >
                      Date
                      {sortField === "timestamp" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        ))}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 p-0 font-medium"
                      onClick={() => handleSort("eventType")}
                    >
                      Type
                      {sortField === "eventType" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        ))}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 p-0 font-medium"
                      onClick={() => handleSort("tokenSymbol")}
                    >
                      Asset
                      {sortField === "tokenSymbol" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        ))}
                    </Button>
                  </TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 p-0 font-medium"
                      onClick={() => handleSort("usdValue")}
                    >
                      USD Value
                      {sortField === "usdValue" &&
                        (sortDirection === "asc" ? (
                          <ArrowUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ArrowDown className="ml-2 h-4 w-4" />
                        ))}
                    </Button>
                  </TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Gas Fee</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{format(transaction.timestamp, "MMM dd")}</span>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(transaction.timestamp)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventTypeIcon(transaction.eventType)}
                        <Badge variant="outline" className="text-xs capitalize">
                          {transaction.eventType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold">{transaction.tokenSymbol.charAt(0)}</span>
                        </div>
                        <span className="font-medium">{transaction.tokenSymbol}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {formatTokenAmount(transaction.amount, transaction.tokenSymbol)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{formatCurrency(transaction.usdValue)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getChainBadgeColor(transaction.chain)}`}>
                        {transaction.chain}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{transaction.walletLabel}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{truncateHash(transaction.transactionHash)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(transaction.transactionHash)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            window.open(getChainExplorerUrl(transaction.chain, transaction.transactionHash), "_blank")
                          }
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{transaction.gasFee} ETH</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedTransaction(transaction)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyToClipboard(transaction.transactionHash)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Hash
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(getChainExplorerUrl(transaction.chain, transaction.transactionHash), "_blank")
                            }
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View on Explorer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTransaction && getEventTypeIcon(selectedTransaction.eventType)}
              Transaction Details
            </DialogTitle>
            <DialogDescription>
              {selectedTransaction && format(selectedTransaction.timestamp, "PPpp")}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Transaction Info</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <Badge variant="outline" className="capitalize">
                        {selectedTransaction.eventType}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="default">{selectedTransaction.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Block:</span>
                      <span className="font-mono">{selectedTransaction.blockNumber.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Asset Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Token:</span>
                      <span className="font-medium">{selectedTransaction.tokenSymbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-mono">{selectedTransaction.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">USD Value:</span>
                      <span className="font-semibold">{formatCurrency(selectedTransaction.usdValue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Addresses</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">From:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{truncateHash(selectedTransaction.fromAddress)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(selectedTransaction.fromAddress)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">To:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{truncateHash(selectedTransaction.toAddress)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(selectedTransaction.toAddress)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Network & Fees</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain:</span>
                    <Badge variant="outline" className={getChainBadgeColor(selectedTransaction.chain)}>
                      {selectedTransaction.chain}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Used:</span>
                    <span className="font-mono">{Number.parseInt(selectedTransaction.gasUsed).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Fee:</span>
                    <span className="font-mono">{selectedTransaction.gasFee} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet:</span>
                    <span>{selectedTransaction.walletLabel}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(
                      getChainExplorerUrl(selectedTransaction.chain, selectedTransaction.transactionHash),
                      "_blank",
                    )
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Explorer
                </Button>
                <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
