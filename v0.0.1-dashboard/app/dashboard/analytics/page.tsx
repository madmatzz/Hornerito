'use client';

import { Card, CardContent } from "@/components/ui/card";
import { MonthlyOverviewChart } from "@/components/analytics/MonthlyOverviewChart";
import { Layout } from "@/components/kokonutui/layout";
import { Content } from "@/components/kokonutui/content";
import { useEffect, useState } from "react";
import { getMonthlyOverview } from "@/lib/data/analytics";

export default function AnalyticsPage() {
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMonthlyOverview();
        setMonthlyData(data);
      } catch (error) {
        console.error('Error fetching monthly data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      <Content>
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Monthly Overview</h3>
            <p className="text-sm text-muted-foreground mb-4">Your spending patterns this month</p>
            <MonthlyOverviewChart data={monthlyData} />
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <div className="col-span-2">
              <h3 className="text-lg font-medium mb-4">Category Breakdown</h3>
              <div className="rounded-xl border bg-card text-card-foreground h-[400px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Chart coming soon</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4">Spending Trends</h3>
              <div className="rounded-xl border bg-card text-card-foreground h-[400px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Chart coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
} 