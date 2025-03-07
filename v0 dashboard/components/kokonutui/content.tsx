'use client';

import { PieChart, CreditCard, Calendar, Bell, User, ArrowDownToLine, ArrowUpToLine } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import List01 from "./list-01"
import List02 from "./list-02"
import List03 from "./list-03"
import SpendChart from "./spend-chart"

export default function Content() {
  return (
    <div className="h-full w-full dark">
      <div className="flex flex-col h-full bg-[#09090B] text-white">
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex items-center justify-between space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-[#18181B] border-[#27272A]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                    <div className="bg-emerald-500/20 rounded-full p-2">
                      <ArrowDownToLine className="w-4 h-4 text-emerald-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$5,000</div>
                    <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#18181B] border-[#27272A]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    <div className="bg-red-500/20 rounded-full p-2">
                      <ArrowUpToLine className="w-4 h-4 text-red-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$1,200</div>
                    <p className="text-xs text-muted-foreground">+10.5% from last month</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#18181B] border-[#27272A]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Account Balance</CardTitle>
                    <div className="bg-blue-500/20 rounded-full p-2">
                      <CreditCard className="w-4 h-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$9,400</div>
                    <p className="text-xs text-muted-foreground">+2.4% from last month</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="bg-[#18181B] border-[#27272A] col-span-4">
                  <CardHeader>
                    <CardTitle>Spend Frequency</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <SpendChart className="h-[200px]" />
                  </CardContent>
                </Card>
                <Card className="bg-[#18181B] border-[#27272A] col-span-3">
                  <CardHeader>
                    <CardTitle>Expense Categories</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <List01 className="h-[200px]" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-[#18181B] border-[#27272A]">
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <List02 className="h-full" />
                    </ScrollArea>
                  </CardContent>
                </Card>
                <Card className="bg-[#18181B] border-[#27272A]">
                  <CardHeader>
                    <CardTitle>Recurring Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <List03 className="h-full" />
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

