'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  FileImage,
  FolderInput,
  Folder,
  FolderPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FolderBreadcrumbs } from './folder-breadcrumbs';
import { CreateFolderDialog } from './create-folder-dialog';
import { MoveToFolderDialog } from './move-to-folder-dialog';

type SortField = 'name' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export function DrawingList() {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    type: 'drawing' | 'folder';
  } | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Move dialog state
  const [moveItem, setMoveItem] = useState<{
    id: string;
    type: 'drawing' | 'folder';
    name: string;
    currentFolderId: string | null;
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: contents, isLoading } = trpc.drawing.folder.getContents.useQuery({
    folderId: currentFolderId,
  });

  const createDrawing = trpc.drawing.create.useMutation({
    onSuccess: (drawing: { id: string }) => {
      utils.drawing.folder.getContents.invalidate();
      setNewDrawingName('');
      setCreateDialogOpen(false);
      router.push(`/drawings/${drawing.id}`);
    },
  });

  const updateDrawing = trpc.drawing.update.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
      setEditingItem(null);
    },
  });

  const deleteDrawing = trpc.drawing.delete.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
    },
  });

  const moveDrawingToFolder = trpc.drawing.moveToFolder.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
      setMoveItem(null);
    },
  });

  const createFolder = trpc.drawing.folder.create.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
    },
    onError: (error) => {
      console.error('Failed to create folder:', error);
    },
  });

  const renameFolder = trpc.drawing.folder.rename.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
      setEditingItem(null);
    },
  });

  const moveFolder = trpc.drawing.folder.move.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
      utils.drawing.folder.getAll.invalidate();
      setMoveItem(null);
    },
  });

  const deleteFolder = trpc.drawing.folder.delete.useMutation({
    onSuccess: () => {
      utils.drawing.folder.getContents.invalidate();
    },
  });

  const handleCreateFolder = (name: string) => {
    createFolder.mutate({ name, parentId: currentFolderId });
  };

  const handleRenameItem = () => {
    if (!editingItem || !editingItem.name.trim()) return;

    if (editingItem.type === 'drawing') {
      updateDrawing.mutate({ id: editingItem.id, name: editingItem.name.trim() });
    } else {
      renameFolder.mutate({ id: editingItem.id, name: editingItem.name.trim() });
    }
  };

  const handleMoveItem = (folderId: string | null) => {
    if (!moveItem) return;

    if (moveItem.type === 'drawing') {
      moveDrawingToFolder.mutate({ id: moveItem.id, folderId });
    } else {
      moveFolder.mutate({ id: moveItem.id, parentId: folderId });
    }
  };

  const handleDeleteItem = (id: string, type: 'drawing' | 'folder') => {
    if (type === 'drawing') {
      deleteDrawing.mutate({ id });
    } else {
      deleteFolder.mutate({ id });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const folders = contents?.folders ?? [];
  const drawings = contents?.drawings ?? [];

  // Combine and sort items
  type ListItem = {
    id: string;
    name: string;
    type: 'folder' | 'drawing';
    updatedAt: Date | string;
    parentId?: string | null;
    folderId?: string | null;
  };

  const allItems: ListItem[] = [
    ...folders.map((f) => ({ ...f, type: 'folder' as const })),
    ...drawings.map((d) => ({ ...d, type: 'drawing' as const })),
  ];

  const sortedItems = [...allItems].sort((a, b) => {
    // Folders always come first
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    // Then sort by the selected field
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else {
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const hasContent = sortedItems.length > 0;

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <FolderBreadcrumbs currentFolderId={currentFolderId} onNavigate={setCurrentFolderId} />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Drawing
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Drawing</DialogTitle>
              <DialogDescription>Enter a name for your new drawing.</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Drawing name"
              value={newDrawingName}
              onChange={(e) => setNewDrawingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDrawingName.trim()) {
                  createDrawing.mutate({
                    name: newDrawingName.trim(),
                    folderId: currentFolderId,
                  });
                }
              }}
              autoFocus
            />
            <DialogFooter>
              <Button
                onClick={() =>
                  createDrawing.mutate({
                    name: newDrawingName.trim(),
                    folderId: currentFolderId,
                  })
                }
                disabled={!newDrawingName.trim() || createDrawing.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CreateFolderDialog
          onCreateFolder={handleCreateFolder}
          isPending={createFolder.isPending}
        />
      </div>

      {hasContent ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Name
                    {getSortIcon('name')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('updatedAt')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    Modified
                    {getSortIcon('updatedAt')}
                  </button>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow
                  key={`${item.type}-${item.id}`}
                  className="cursor-pointer"
                  onClick={() => {
                    if (item.type === 'folder') {
                      setCurrentFolderId(item.id);
                    } else {
                      router.push(`/drawings/${item.id}`);
                    }
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.type === 'folder' ? (
                        <Folder className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <FileImage className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem({
                              id: item.id,
                              name: item.name,
                              type: item.type,
                            });
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveItem({
                              id: item.id,
                              type: item.type,
                              name: item.name,
                              currentFolderId:
                                item.type === 'folder'
                                  ? (item.parentId ?? null)
                                  : (item.folderId ?? null),
                            });
                          }}
                        >
                          <FolderInput className="mr-2 h-4 w-4" />
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id, item.type);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center">
          <FileImage className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            {currentFolderId ? 'This folder is empty.' : "You don't have any drawings yet."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {currentFolderId ? 'Create Drawing' : 'Create Your First Drawing'}
            </Button>
            <CreateFolderDialog
              onCreateFolder={handleCreateFolder}
              isPending={createFolder.isPending}
              trigger={
                <Button variant="outline">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </Button>
              }
            />
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename {editingItem?.type === 'folder' ? 'Folder' : 'Drawing'}
            </DialogTitle>
            <DialogDescription>
              Enter a new name for this {editingItem?.type === 'folder' ? 'folder' : 'drawing'}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={editingItem?.name ?? ''}
            onChange={(e) =>
              setEditingItem((prev) => (prev ? { ...prev, name: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editingItem?.name.trim()) {
                handleRenameItem();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              onClick={handleRenameItem}
              disabled={
                !editingItem?.name.trim() || updateDrawing.isPending || renameFolder.isPending
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      {moveItem && (
        <MoveToFolderDialog
          open={!!moveItem}
          onOpenChange={(open) => !open && setMoveItem(null)}
          itemId={moveItem.id}
          itemType={moveItem.type}
          itemName={moveItem.name}
          currentFolderId={moveItem.currentFolderId}
          excludeFolderId={moveItem.type === 'folder' ? moveItem.id : undefined}
          onMove={handleMoveItem}
          isPending={moveDrawingToFolder.isPending || moveFolder.isPending}
        />
      )}
    </div>
  );
}
