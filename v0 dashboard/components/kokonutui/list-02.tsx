'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, PlayCircle, Coffee, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Transaction {
  id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  displayCategory: string;
  type: 'income' | 'expense';
}

interface Props {
  className?: string;
}

export default function List02({ className }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recent-expenses')
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load transactions');
        setLoading(false);
      });
  }, []);

  const getCategoryIcon = (category: string, type: 'income' | 'expense') => {
    if (type === 'income') {
      return { 
        icon: ArrowDownToLine, 
        bgColor: 'bg-emerald-500/20', 
        iconColor: 'text-emerald-500' 
      };
    }
    
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('shopping')) {
      return { 
        icon: ShoppingBag, 
        bgColor: 'bg-orange-500/20', 
        iconColor: 'text-orange-500' 
      };
    } else if (lowerCategory.includes('subscription')) {
      return { 
        icon: PlayCircle, 
        bgColor: 'bg-purple-500/20', 
        iconColor: 'text-purple-500' 
      };
    } else {
      return { 
        icon: Coffee, 
        bgColor: 'bg-pink-500/20', 
        iconColor: 'text-pink-500' 
      };
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatAmount = (amount: number, type: 'income' | 'expense') => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));

    return type === 'income' ? formatted : `-${formatted}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="relative w-10 h-10">
          <div className="absolute w-full h-full border-4 border-zinc-200 dark:border-zinc-700 rounded-full"></div>
          <div className="absolute w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <span className="ml-3 text-sm text-zinc-600 dark:text-zinc-400">Loading transactions...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {transactions.map((transaction, index) => {
        const { icon: Icon, bgColor, iconColor } = getCategoryIcon(transaction.category, transaction.type);
        return (
          <div key={transaction.id}>
            <div className="flex items-center justify-between p-4 rounded-lg hover:bg-[#27272A] transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${bgColor}`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-200">{transaction.displayCategory}</p>
                  <p className="text-sm text-gray-400">{transaction.description || 'No description'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-medium text-sm ${
                  transaction.type === 'income' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {formatAmount(transaction.amount, transaction.type)}
                </p>
                <p className="text-sm text-gray-400">{formatTime(transaction.date)}</p>
              </div>
            </div>
            {index < transactions.length - 1 && (
              <Separator className="my-1 bg-[#27272A]" />
            )}
          </div>
        );
      })}
      
      {transactions.length === 0 && (
        <div className="text-center text-gray-400 py-4">
          No recent transactions
        </div>
      )}
    </div>
  );
}

