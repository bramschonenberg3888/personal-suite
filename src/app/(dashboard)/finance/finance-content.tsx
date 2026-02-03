'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RevenueDashboard } from '@/components/revenue/revenue-dashboard';
import { CostsDashboard } from '@/components/costs/costs-dashboard';
import { InvoicesDashboard } from '@/components/invoices/invoices-dashboard';
import { TargetTracking } from '@/components/revenue/target-tracking';
import { SimplicateSettings } from '@/components/simplicate/simplicate-settings';
import { NotionRevenueSettings } from '@/components/revenue/notion-settings-dialog';
import { NotionCostsSettings } from '@/components/costs/costs-settings-dialog';
import { TimeEntriesList } from '@/components/revenue/time-entries-list';
import { DollarSign, Receipt, Settings } from 'lucide-react';
import { usePersistedState } from '@/hooks/use-persisted-state';

export function FinanceContent() {
  const [activeTab, setActiveTab] = usePersistedState('finance.activeTab', 'revenue');
  const [activeSubTab, setActiveSubTab] = usePersistedState(
    'finance.revenue.activeSubTab',
    'dashboard'
  );
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track your revenue and costs from Notion
        </p>
      </div>

      {!mounted ? (
        <div className="bg-muted h-10 w-full animate-pulse rounded-lg" />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="revenue" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="costs" className="gap-2">
              <Receipt className="h-4 w-4" />
              Costs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="revenue">
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-6">
              <TabsList>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="targets">Targets</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
                <TabsTrigger value="simplicate">Simplicate Sync</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <RevenueDashboard />
              </TabsContent>

              <TabsContent value="targets">
                <TargetTracking />
              </TabsContent>

              <TabsContent value="invoices">
                <InvoicesDashboard />
              </TabsContent>

              <TabsContent value="simplicate">
                <TimeEntriesList />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="costs">
            <CostsDashboard />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <NotionRevenueSettings />
              <NotionCostsSettings />
              <SimplicateSettings />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
