'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Folder, ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (_isOpen: boolean) => void;
  itemId: string;
  itemType: 'drawing' | 'folder';
  itemName: string;
  currentFolderId: string | null;
  excludeFolderId?: string; // Exclude this folder and its descendants (for folder move)
  onMove: (_targetFolderId: string | null) => void;
  isPending?: boolean;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  itemType,
  itemName,
  currentFolderId,
  excludeFolderId,
  onMove,
  isPending,
}: MoveToFolderDialogProps) {
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);

  const { data: contents } = trpc.drawing.folder.getContents.useQuery(
    { folderId: browseFolderId },
    { enabled: open }
  );

  const { data: path } = trpc.drawing.folder.getPath.useQuery(
    { folderId: browseFolderId! },
    { enabled: open && !!browseFolderId }
  );

  // Filter out the folder being moved (and its descendants would be excluded by the API)
  const folders = contents?.folders.filter((f) => f.id !== excludeFolderId) ?? [];

  const handleMove = () => {
    onMove(selectedFolderId);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setBrowseFolderId(null);
      setSelectedFolderId(currentFolderId);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move {itemType === 'folder' ? 'Folder' : 'Drawing'}: {itemName}
          </DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center gap-1 text-sm border-b pb-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7 px-2', browseFolderId === null && 'bg-accent')}
              onClick={() => {
                setBrowseFolderId(null);
                setSelectedFolderId(null);
              }}
            >
              <Home className="h-4 w-4" />
            </Button>

            {path?.map((segment) => (
              <div key={segment.id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 px-2', browseFolderId === segment.id && 'bg-accent')}
                  onClick={() => {
                    setBrowseFolderId(segment.id);
                    setSelectedFolderId(segment.id);
                  }}
                >
                  {segment.name}
                </Button>
              </div>
            ))}
          </nav>

          {/* Folder list */}
          <div className="min-h-[200px] max-h-[300px] overflow-y-auto">
            {/* Current location indicator */}
            <div
              className={cn(
                'flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent/50',
                selectedFolderId === browseFolderId && 'bg-accent'
              )}
              onClick={() => setSelectedFolderId(browseFolderId)}
            >
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {browseFolderId === null ? 'Root (Home)' : 'Current folder'}
              </span>
            </div>

            {folders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No subfolders</p>
            ) : (
              <div className="space-y-1 mt-2">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent/50',
                      selectedFolderId === folder.id && 'bg-accent'
                    )}
                    onClick={() => setSelectedFolderId(folder.id)}
                    onDoubleClick={() => {
                      setBrowseFolderId(folder.id);
                      setSelectedFolderId(folder.id);
                    }}
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{folder.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrowseFolderId(folder.id);
                        setSelectedFolderId(folder.id);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={selectedFolderId === currentFolderId || isPending}>
            Move Here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
