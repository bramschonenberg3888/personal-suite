'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RevenueDashboard } from '@/components/revenue/revenue-dashboard';
import { CostsDashboard } from '@/components/costs/costs-dashboard';
import { InvoicesDashboard } from '@/components/invoices/invoices-dashboard';
import { TargetTracking } from '@/components/revenue/target-tracking';
import { SimplicateSettings } from '@/components/simplicate/simplicate-settings';
import { DollarSign, Receipt, FileText, Target, Settings } from 'lucide-react';
import { usePersistedState } from '@/hooks/use-persisted-state';

export function FinanceContent() {
  const [activeTab, setActiveTab] = usePersistedState('finance.activeTab', 'revenue');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track your revenue and costs from Notion
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="revenue" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-2">
            <Target className="h-4 w-4" />
            Targets
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Invoices
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
          <RevenueDashboard />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesDashboard />
        </TabsContent>

        <TabsContent value="costs">
          <CostsDashboard />
        </TabsContent>

        <TabsContent value="targets">
          <TargetTracking />
        </TabsContent>

        <TabsContent value="settings">
          <SimplicateSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
