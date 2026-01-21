'use client';

import { use } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { StockHeader } from '@/components/portfolio/stock-header';
import { PriceChart } from '@/components/portfolio/price-chart';
import { KeyStatistics } from '@/components/portfolio/key-statistics';
import { CompanyProfile } from '@/components/portfolio/company-profile';
import { ETFOverview } from '@/components/portfolio/etf-overview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface StockDetailPageProps {
  params: Promise<{ symbol: string }>;
}

export default function StockDetailPage({ params }: StockDetailPageProps) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol);

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = trpc.portfolio.prices.getSummary.useQuery({ symbol });

  // Get portfolio items to find the ISIN for this symbol
  const { data: portfolioItems } = trpc.portfolio.items.getAll.useQuery();
  const portfolioItem = portfolioItems?.find((item) => item.symbol === symbol);

  const isETF = summary?.quoteType === 'ETF' || summary?.quoteType === 'MUTUALFUND';

  // Fetch ETF profile if this is an ETF
  const { data: etfProfile, isLoading: isEtfLoading } = trpc.portfolio.etf.getProfile.useQuery(
    { symbol, isin: portfolioItem?.isin },
    { enabled: isETF && !isSummaryLoading }
  );

  // For ETFs, search news by fund name for better results
  const newsSearchName = isETF ? summary?.longName || summary?.shortName : undefined;
  const { data: news, isLoading: isNewsLoading } = trpc.portfolio.news.getBySymbols.useQuery({
    symbols: [symbol],
    searchByName: newsSearchName,
  });

  if (isSummaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-xl font-semibold mb-2">Stock Not Found</h2>
        <p className="text-muted-foreground mb-4">
          Could not find data for symbol &quot;{symbol}&quot;
        </p>
        <Link href="/portfolio" className="text-primary hover:underline">
          Back to Portfolio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StockHeader summary={summary} />

      <PriceChart symbol={symbol} currency={summary.currency} />

      {isETF ? (
        isEtfLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : etfProfile ? (
          <ETFOverview profile={etfProfile} currency={summary.currency} />
        ) : (
          // Fallback to standard components if no ETF profile available
          <>
            <KeyStatistics summary={summary} />
            <CompanyProfile summary={summary} />
          </>
        )
      ) : (
        <>
          <KeyStatistics summary={summary} />
          <CompanyProfile summary={summary} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related News</CardTitle>
        </CardHeader>
        <CardContent>
          {isNewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : news && news.length > 0 ? (
            <div className="space-y-4">
              {news.slice(0, 5).map((item) => (
                <a
                  key={item.uuid}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex gap-4">
                    {item.thumbnail?.resolutions?.[0]?.url && (
                      <Image
                        src={item.thumbnail.resolutions[0].url}
                        alt=""
                        width={80}
                        height={56}
                        className="w-20 h-14 object-cover rounded"
                        unoptimized
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-2">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{item.publisher}</span>
                        <span>·</span>
                        <span>
                          {new Date(item.providerPublishTime * 1000).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No news available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
