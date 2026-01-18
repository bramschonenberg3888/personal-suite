'use client';

import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home } from 'lucide-react';

interface FolderBreadcrumbsProps {
  currentFolderId: string | null;
  onNavigate: (_id: string | null) => void;
}

export function FolderBreadcrumbs({ currentFolderId, onNavigate }: FolderBreadcrumbsProps) {
  const { data: path } = trpc.drawing.folder.getPath.useQuery(
    { folderId: currentFolderId! },
    { enabled: !!currentFolderId }
  );

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => onNavigate(null)}
        disabled={!currentFolderId}
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Button>

      {path?.map((segment, index) => (
        <div key={segment.id} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => onNavigate(segment.id)}
            disabled={index === path.length - 1}
          >
            {segment.name}
          </Button>
        </div>
      ))}
    </nav>
  );
}
