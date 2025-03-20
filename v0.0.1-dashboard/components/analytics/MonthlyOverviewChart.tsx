"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Maximize2, Minimize2 } from 'lucide-react';
import { MonthlyOverviewData } from "@/lib/data/analytics";

interface MonthlyOverviewChartProps {
  data: MonthlyOverviewData[];
}

export function MonthlyOverviewChart({ data }: MonthlyOverviewChartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState("month");

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="h-full w-full flex flex-col">
          <div className="flex-none p-6 border-b">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Time Range:</span>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">Last 3 Months</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExpand}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex-none px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-medium mb-2">Total Spent</h4>
                  <p className="text-2xl font-bold">
                    ${data.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-medium mb-2">Average Daily</h4>
                  <p className="text-2xl font-bold">
                    ${(data.reduce((sum, item) => sum + item.amount, 0) / data.length).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-medium mb-2">Highest Day</h4>
                  <p className="text-2xl font-bold">
                    ${Math.max(...data.map(item => item.amount)).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex-1 px-6 pb-6 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                margin={{ top: 20, right: 40, left: 40, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date"
                  fontSize={14}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  fontSize={14}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `$${value}`}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-sm">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">
                                Date
                              </span>
                              <span className="font-bold text-muted-foreground text-lg">
                                {payload[0].payload.date}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">
                                Amount
                              </span>
                              <span className="font-bold text-lg">
                                ${payload[0].value}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="currentColor"
                  radius={[4, 4, 0, 0]}
                  className="fill-primary"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExpand}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                tickFormatter={(value) => `$${value}`}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">
                              Date
                            </span>
                            <span className="font-bold text-muted-foreground text-lg">
                              {payload[0].payload.date}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">
                              Amount
                            </span>
                            <span className="font-bold text-lg">
                              ${payload[0].value}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="amount"
                fill="currentColor"
                radius={[4, 4, 0, 0]}
                className="fill-primary"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 