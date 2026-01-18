'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { ComponentProps } from 'react';
import '@excalidraw/excalidraw/index.css';

const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Skeleton className="h-full w-full" />
    </div>
  ),
});

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;

export function ExcalidrawWrapper(props: ExcalidrawProps) {
  return <Excalidraw {...props} />;
}

export { Excalidraw };
