"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ArrowUpRight, ArrowDownLeft, Wallet, QrCode, Settings, CreditCard, Clock } from "lucide-react"

interface AccountItem {
  id: string
  title: string
  description?: string
  balance: string
  type: "savings" | "checking" | "investment" | "debt"
}

interface List01Props {
  totalBalance?: string
  accounts?: AccountItem[]
  className?: string
}

type TimePeriod = "week" | "month" | "3months" | "year"

interface FinancialSummary {
  spent: string
  income: string
}

const financialData: Record<TimePeriod, FinancialSummary> = {
  week: {
    spent: "$1,245.80",
    income: "$2,100.00",
  },
  month: {
    spent: "$4,890.25",
    income: "$6,500.00",
  },
  "3months": {
    spent: "$12,450.75",
    income: "$19,500.00",
  },
  year: {
    spent: "$48,920.30",
    income: "$78,000.00",
  },
}

const ACCOUNTS: AccountItem[] = [
  {
    id: "1",
    title: "Main Savings",
    description: "Personal savings",
    balance: "$8,459.45",
    type: "savings",
  },
  {
    id: "2",
    title: "Checking Account",
    description: "Daily expenses",
    balance: "$2,850.00",
    type: "checking",
  },
  {
    id: "3",
    title: "Investment Portfolio",
    description: "Stock & ETFs",
    balance: "$15,230.80",
    type: "investment",
  },
  {
    id: "4",
    title: "Credit Card",
    description: "Pending charges",
    balance: "$1,200.00",
    type: "debt",
  },
  {
    id: "5",
    title: "Savings Account",
    description: "Emergency fund",
    balance: "$3,000.00",
    type: "savings",
  },
]

export default function List01({ totalBalance = "$26,540.25", accounts = ACCOUNTS, className }: List01Props) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month")

  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period)
  }

  return (
    <div
      className={cn(
        "w-full max-w-xl mx-auto",
        "bg-white dark:bg-zinc-900/70",
        "border border-zinc-100 dark:border-zinc-800",
        "rounded-xl shadow-sm backdrop-blur-xl",
        className,
      )}
    >
      {/* Total Balance Section */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="mb-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Total Balance</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{totalBalance}</h1>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Cash Flow</h2>
            </div>

            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              {[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "3months", label: "3M" },
                { value: "year", label: "Year" },
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => handleTimePeriodChange(period.value as TimePeriod)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-md transition-colors",
                    timePeriod === period.value
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200",
                  )}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Total Spent</p>
              </div>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">{financialData[timePeriod].spent}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
                {timePeriod === "week"
                  ? "Last 7 days"
                  : timePeriod === "month"
                    ? "Last 30 days"
                    : timePeriod === "3months"
                      ? "Last 90 days"
                      : "Last 365 days"}
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Total Income</p>
              </div>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {financialData[timePeriod].income}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
                {timePeriod === "week"
                  ? "Last 7 days"
                  : timePeriod === "month"
                    ? "Last 30 days"
                    : timePeriod === "3months"
                      ? "Last 90 days"
                      : "Last 365 days"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">Your Accounts</h2>
        </div>

        <div className="space-y-1">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={cn(
                "group flex items-center justify-between",
                "p-2 rounded-lg",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                "transition-all duration-200",
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn("p-1.5 rounded-lg", {
                    "bg-emerald-100 dark:bg-emerald-900/30": account.type === "savings",
                    "bg-blue-100 dark:bg-blue-900/30": account.type === "checking",
                    "bg-purple-100 dark:bg-purple-900/30": account.type === "investment",
                  })}
                >
                  {account.type === "savings" && (
                    <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {account.type === "checking" && <QrCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  {account.type === "investment" && (
                    <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  )}
                  {account.type === "debt" && <CreditCard className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{account.title}</h3>
                  {account.description && (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{account.description}</p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{account.balance}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Updated footer with two buttons */}
      <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2",
              "py-2 px-3 rounded-lg",
              "text-xs font-medium",
              "bg-zinc-900 dark:bg-zinc-50",
              "text-zinc-50 dark:text-zinc-900",
              "hover:bg-zinc-800 dark:hover:bg-zinc-200",
              "shadow-sm hover:shadow",
              "transition-all duration-200",
            )}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Top-up</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2",
              "py-2 px-3 rounded-lg",
              "text-xs font-medium",
              "bg-zinc-900 dark:bg-zinc-50",
              "text-zinc-50 dark:text-zinc-900",
              "hover:bg-zinc-800 dark:hover:bg-zinc-200",
              "shadow-sm hover:shadow",
              "transition-all duration-200",
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Wallet Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}

