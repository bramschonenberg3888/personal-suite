'use client';

import { ETFKeyData } from './etf-key-data';
import { ETFHoldings } from './etf-holdings';
import { ETFAllocationChart } from './etf-allocation-chart';
import type { ETFProfile } from '@/lib/api/justetf';

interface ETFOverviewProps {
  profile: ETFProfile;
  currency?: string;
}

export function ETFOverview({ profile, currency }: ETFOverviewProps) {
  return (
    <div className="space-y-6">
      <ETFKeyData profile={profile} currency={currency} />

      {profile.holdings.length > 0 && (
        <ETFHoldings holdings={profile.holdings} totalHoldings={profile.totalHoldings} />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {profile.sectorAllocation.length > 0 && (
          <ETFAllocationChart
            data={profile.sectorAllocation}
            title="Sector Allocation"
            isin={profile.isin}
          />
        )}

        {profile.countryAllocation.length > 0 && (
          <ETFAllocationChart
            data={profile.countryAllocation}
            title="Country Allocation"
            isin={profile.isin}
          />
        )}
      </div>

      {profile.assetAllocation.length > 0 && (
        <ETFAllocationChart data={profile.assetAllocation} title="Asset Allocation" maxItems={5} />
      )}
    </div>
  );
}
