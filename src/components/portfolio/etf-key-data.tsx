'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, Globe, Landmark, Wallet } from 'lucide-react';
import type { ETFProfile } from '@/lib/api/justetf';

interface ETFKeyDataProps {
  profile: ETFProfile;
  currency?: string;
}

interface StatItemProps {
  label: string;
  value: string | undefined;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex justify-between py-2 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '-'}</span>
    </div>
  );
}

export function ETFKeyData({ profile, currency = 'EUR' }: ETFKeyDataProps) {
  const formatPercent = (value?: number) => {
    if (value === undefined) return undefined;
    return `${value.toFixed(2)}%`;
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined) return undefined;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ETF Key Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {profile.provider && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {profile.provider}
            </Badge>
          )}
          {profile.replicationMethod && (
            <Badge variant="outline">{profile.replicationMethod}</Badge>
          )}
          {profile.distributionPolicy && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              {profile.distributionPolicy}
            </Badge>
          )}
          {profile.domicile && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {profile.domicile}
            </Badge>
          )}
          {profile.fundCurrency && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Landmark className="h-3 w-3" />
              {profile.fundCurrency}
            </Badge>
          )}
          {profile.inceptionDate && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {profile.inceptionDate}
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-x-8">
          <div>
            <StatItem label="Expense Ratio (TER)" value={formatPercent(profile.expenseRatio)} />
            <StatItem label="Fund Size (AUM)" value={formatCurrency(profile.aum)} />
            <StatItem label="Inception Date" value={profile.inceptionDate} />
          </div>
          <div>
            <StatItem label="Replication" value={profile.replicationMethod} />
            <StatItem label="Distribution" value={profile.distributionPolicy} />
            <StatItem label="Domicile" value={profile.domicile} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
