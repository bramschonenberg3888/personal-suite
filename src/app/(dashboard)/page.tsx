import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Pencil, ShoppingCart, Cloud } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    title: 'Portfolio',
    description: 'Track your stocks and ETFs with real-time prices',
    href: '/portfolio',
    icon: LineChart,
  },
  {
    title: 'Drawings',
    description: 'Create and manage Excalidraw drawings',
    href: '/drawings',
    icon: Pencil,
  },
  {
    title: 'Personal Shopper',
    description: 'Track prices at Albert Heijn and Jumbo',
    href: '/shopper',
    icon: ShoppingCart,
  },
  {
    title: 'Weather',
    description: 'Check the weather forecast for your location',
    href: '/weather',
    icon: Cloud,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Personal Suite</h1>
        <p className="text-muted-foreground">
          Your personal dashboard for tracking stocks, drawings, shopping, and weather.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{feature.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
