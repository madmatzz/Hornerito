'use client';

import { cn } from "@/lib/utils"
import { useExpenses } from "@/hooks/useExpenses"
import { useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from "@/components/ui/card"

// Add loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <div className="relative w-10 h-10">
      <div className="absolute w-full h-full border-4 border-zinc-200 dark:border-zinc-700 rounded-full"></div>
      <div className="absolute w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
    <span className="ml-3 text-sm text-zinc-600 dark:text-zinc-400">Loading data...</span>
  </div>
);

interface List01Props {
  className?: string
}

// Modern color palette
const COLORS = [
  '#2DD4BF', // Modern Teal
  '#8B5CF6', // Modern Purple
  '#F43F5E', // Modern Pink/Red
  '#0EA5E9', // Modern Sky Blue
  '#F59E0B', // Modern Amber
  '#10B981', // Modern Emerald
  '#6366F1', // Modern Indigo
  '#EC4899', // Modern Hot Pink
  '#84CC16', // Modern Lime
  '#14B8A6', // Modern Light Teal
];

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to normalize category names
const normalizeCategory = (category: string) => {
  return category.toLowerCase().trim();
};

// Helper function to format category names for display
const formatCategory = (category: string) => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function List01({ className }: List01Props) {
  const { expenses, loading, error } = useExpenses();

  const categorySummary = useMemo(() => {
    if (!expenses || !expenses.length) {
      console.log('No expenses data available');
      return [];
    }

    console.log('Processing expenses:', expenses);

    const summary = expenses.reduce((acc, expense) => {
      const mainCategory = normalizeCategory(expense.category);
      if (!acc[mainCategory]) {
        acc[mainCategory] = { 
          total: 0, 
          count: 0,
          displayName: formatCategory(mainCategory),
          transactions: [],
          avgAmount: 0,
          minAmount: Infinity,
          maxAmount: -Infinity
        };
      }
      acc[mainCategory].total += expense.amount;
      acc[mainCategory].count += 1;
      acc[mainCategory].transactions.push(expense);
      acc[mainCategory].minAmount = Math.min(acc[mainCategory].minAmount, expense.amount);
      acc[mainCategory].maxAmount = Math.max(acc[mainCategory].maxAmount, expense.amount);
      return acc;
    }, {} as Record<string, { 
      total: number; 
      count: number; 
      displayName: string;
      transactions: Expense[];
      avgAmount: number;
      minAmount: number;
      maxAmount: number;
    }>);

    // Calculate averages
    Object.values(summary).forEach(cat => {
      cat.avgAmount = cat.total / cat.count;
    });

    console.log('Category summary:', summary);

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return Object.entries(summary)
      .map(([category, data]) => ({
        name: data.displayName,
        category: category,
        total: data.total,
        count: data.count,
        percentage: (data.total / totalAmount) * 100,
        value: data.total, // for Recharts
        avgAmount: data.avgAmount,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const spendData = useMemo(() => [
    { name: 'Mon', amount: 2400 },
    { name: 'Tue', amount: 1398 },
    { name: 'Wed', amount: 3200 },
    { name: 'Thu', amount: 2800 },
    { name: 'Fri', amount: 1908 },
    { name: 'Sat', amount: 2800 },
    { name: 'Sun', amount: 2400 },
  ], []);

  const categoryData = useMemo(() => [
    { name: 'Shopping', value: 1200 },
    { name: 'Bills', value: 900 },
    { name: 'Entertainment', value: 600 },
    { name: 'Travel', value: 400 },
    { name: 'Food', value: 800 },
  ], []);

  // Add daily expense summary calculation
  const dailyExpenseSummary = useMemo(() => {
    if (!expenses || !expenses.length) return [];

    // Group expenses by date
    const dailyGroups = expenses.reduce((acc, expense) => {
      const date = new Date(expense.date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(expense.amount);
      return acc;
    }, {} as Record<string, number[]>);

    // Convert to chart format
    return Object.entries(dailyGroups)
      .map(([date, amounts]) => {
        const sortedAmounts = amounts.sort((a, b) => a - b);
        return {
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          min: sortedAmounts[0],
          max: sortedAmounts[sortedAmounts.length - 1],
          avg: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
          total: amounts.reduce((sum, amount) => sum + amount, 0)
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7); // Last 7 days
  }, [expenses]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload[0].payload) {
      const data = payload[0].payload;
      const percentage = data.percentage || 0;
      return (
        <Card className="bg-[#27272A] border-[#3F3F46] shadow-lg">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-white">{data.name}</p>
            <p className="text-xs text-gray-400">
              {formatCurrency(data.total || 0)} ({percentage.toFixed(1)}%)
            </p>
            <p className="text-xs text-gray-400">{data.count || 0} transactions</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const radian = Math.PI / 180;
    const x = cx + radius * Math.cos(-midAngle * radian);
    const y = cy + radius * Math.sin(-midAngle * radian);
    
    if (percent < 0.03) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="#9CA3AF"
        textAnchor="middle" 
        dominantBaseline="middle"
        className="text-[10px] font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className={cn("space-y-6 w-full", className)}>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="text-center text-red-500 py-12">Error loading expenses</div>
      ) : (
        <div className="flex flex-col w-full">
          {/* Expense Categories */}
          <div className="w-full bg-zinc-900 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-200 mb-4">Expense Categories</h3>
            <div className="flex gap-4">
              <div className="w-[60%] relative" style={{ height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySummary}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={85}
                      innerRadius={65}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth={1}
                      paddingAngle={2}
                    >
                      {categorySummary.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          className="hover:opacity-90 transition-opacity cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={<CustomTooltip />}
                      position={{ y: 0 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-[40%] max-h-[220px] overflow-auto pr-2">
                <div className="space-y-2">
                  {categorySummary.map((item, index) => (
                    <div 
                      key={item.category} 
                      className="flex items-center justify-between text-sm hover:bg-[#27272A] p-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full shadow-sm" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-gray-300 text-xs">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-gray-400 text-xs font-medium">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

