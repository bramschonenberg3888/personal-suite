'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RevenueDashboard } from '@/components/revenue/revenue-dashboard';
import { CostsDashboard } from '@/components/costs/costs-dashboard';
import { InvoicesDashboard } from '@/components/invoices/invoices-dashboard';
import { DollarSign, Receipt, FileText } from 'lucide-react';

export function FinanceContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track your revenue and costs from Notion
        </p>
      </div>

      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="revenue" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-2">
            <Receipt className="h-4 w-4" />
            Costs
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
      </Tabs>
    </div>
  );
}
