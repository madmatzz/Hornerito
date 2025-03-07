'use client';

import { cn } from "@/lib/utils"
import { useExpenses } from "@/hooks/useExpenses"
import { Clock } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface List03Props {
  className?: string
}

export default function List03({ className }: List03Props) {
  const { recurringExpenses, loading, error } = useExpenses();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="relative w-10 h-10">
          <div className="absolute w-full h-full border-4 border-zinc-200 dark:border-zinc-700 rounded-full"></div>
          <div className="absolute w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <span className="ml-3 text-sm text-zinc-600 dark:text-zinc-400">Loading recurring expenses...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {recurringExpenses.map((expense, index) => (
        <div key={expense.id}>
          <div className={cn(
            "group flex items-center gap-4 p-4",
            "rounded-lg",
            "hover:bg-[#27272A]",
            "transition-all duration-200",
          )}>
            <div className={cn(
              "p-2 rounded-lg",
              "bg-[#27272A]",
              "border border-[#3F3F46]",
            )}>
              <Clock className="w-4 h-4 text-gray-200" />
            </div>

            <div className="flex-1 flex items-center justify-between min-w-0">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-200">
                  {expense.description || expense.category}
                </h3>
                <p className="text-xs text-gray-400">
                  {expense.frequency} payment
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-red-500">
                  {formatAmount(expense.amount)}
                </p>
                <p className="text-xs text-gray-400">
                  Next payment in 3 days
                </p>
              </div>
            </div>
          </div>
          {index < recurringExpenses.length - 1 && (
            <Separator className="my-1 bg-[#27272A]" />
          )}
        </div>
      ))}

      {recurringExpenses.length === 0 && (
        <div className="text-center text-gray-400 py-4">
          No recurring expenses set up yet
        </div>
      )}
    </div>
  );
}

