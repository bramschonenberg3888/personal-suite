'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Building2, MapPin, Users } from 'lucide-react';
import type { QuoteSummary } from '@/lib/api/yahoo-finance';

interface CompanyProfileProps {
  summary: QuoteSummary;
}

export function CompanyProfile({ summary }: CompanyProfileProps) {
  const hasProfileInfo =
    summary.sector ||
    summary.industry ||
    summary.longBusinessSummary ||
    summary.website ||
    summary.fullTimeEmployees;

  if (!hasProfileInfo) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Company Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {summary.sector && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {summary.sector}
            </Badge>
          )}
          {summary.industry && <Badge variant="outline">{summary.industry}</Badge>}
          {summary.city && summary.country && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {summary.city}, {summary.country}
            </Badge>
          )}
          {summary.fullTimeEmployees && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {new Intl.NumberFormat('en-US').format(summary.fullTimeEmployees)} employees
            </Badge>
          )}
        </div>

        {summary.website && (
          <a
            href={summary.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {summary.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {summary.longBusinessSummary && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary.longBusinessSummary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
