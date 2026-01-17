'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { NewsItem } from '@/lib/api/yahoo-finance';
import { formatDistanceToNow } from 'date-fns';

interface NewsCardProps {
  news: NewsItem;
}

export function NewsCard({ news }: NewsCardProps) {
  const publishDate = new Date(news.providerPublishTime * 1000);
  const timeAgo = formatDistanceToNow(publishDate, { addSuffix: true });

  const thumbnail = news.thumbnail?.resolutions?.[0]?.url;

  return (
    <Card className="overflow-hidden">
      <a
        href={news.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-accent/50 transition-colors"
      >
        <CardContent className="flex gap-4 p-4">
          {thumbnail && (
            <div className="relative shrink-0 w-24 h-16 rounded overflow-hidden bg-muted">
              <Image src={thumbnail} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium line-clamp-2 text-sm">{news.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">{news.publisher}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            {news.relatedTickers && news.relatedTickers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {news.relatedTickers.slice(0, 3).map((ticker) => (
                  <Badge key={ticker} variant="secondary" className="text-xs">
                    {ticker}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </a>
    </Card>
  );
}
