'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { DrawingCanvas } from '@/components/drawing/drawing-canvas';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
// Use unknown since Excalidraw types are complex and stored as JSON
type DrawingElements = unknown[];

interface DrawingEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function DrawingEditorPage({ params }: DrawingEditorPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();

  const {
    data: drawing,
    isLoading,
    error,
  } = trpc.drawing.getById.useQuery({
    id: resolvedParams.id,
  }) as {
    data:
      | {
          id: string;
          name: string;
          elements: unknown;
          appState: unknown;
          files: Array<{
            fileId: string;
            mimeType: string;
            dataUrl: string;
          }>;
        }
      | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  const { data: libraries } = trpc.drawing.library.getAll.useQuery() as {
    data:
      | Array<{
          id: string;
          name: string;
          items: unknown;
        }>
      | undefined;
  };

  const updateLibrary = trpc.drawing.library.update.useMutation();

  // Combine all library items
  const allLibraryItems: unknown[] = [];
  if (libraries) {
    for (const lib of libraries) {
      const items = lib.items as any;
      if (Array.isArray(items)) {
        allLibraryItems.push(...items);
      }
    }
  }

  const handleLibraryChange = (items: unknown[]) => {
    // Save to default library or create one
    if (libraries && libraries.length > 0) {
      updateLibrary.mutate({
        id: libraries[0].id,
        items,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 border-b p-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error || !drawing) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Drawing not found</p>
        <Button onClick={() => router.push('/drawings')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Drawings
        </Button>
      </div>
    );
  }

  // Convert files to the format expected by DrawingCanvas
  const initialFiles = drawing.files
    ? Object.fromEntries(
        drawing.files.map((f) => [f.fileId, { mimeType: f.mimeType, dataUrl: f.dataUrl }])
      )
    : undefined;

  return (
    <div className="flex h-full flex-col -m-6">
      <div className="flex items-center gap-4 border-b px-4 py-2">
        <Link href="/drawings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{drawing.name}</h1>
      </div>
      <div className="flex-1" style={{ height: 'calc(100vh - 120px)' }}>
        <DrawingCanvas
          drawingId={drawing.id}
          initialElements={(drawing.elements ?? []) as DrawingElements}
          initialAppState={drawing.appState as Record<string, unknown> | null}
          initialFiles={initialFiles}
          libraryItems={allLibraryItems}
          onLibraryChange={handleLibraryChange}
        />
      </div>
    </div>
  );
}
