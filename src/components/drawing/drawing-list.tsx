'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, MoreVertical, Pencil, Trash2, FileImage } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function DrawingList() {
  const router = useRouter();
  const [newDrawingName, setNewDrawingName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDrawing, setEditingDrawing] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: drawings, isLoading } = trpc.drawing.getAll.useQuery();

  const createDrawing = trpc.drawing.create.useMutation({
    onSuccess: (drawing: { id: string }) => {
      utils.drawing.getAll.invalidate();
      setNewDrawingName('');
      setCreateDialogOpen(false);
      router.push(`/drawings/${drawing.id}`);
    },
  });

  const updateDrawing = trpc.drawing.update.useMutation({
    onSuccess: () => {
      utils.drawing.getAll.invalidate();
      setEditingDrawing(null);
    },
  });

  const deleteDrawing = trpc.drawing.delete.useMutation({
    onSuccess: () => {
      utils.drawing.getAll.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
            </DialogHeader>
            <Input
              placeholder="Drawing name"
              value={newDrawingName}
              onChange={(e) => setNewDrawingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDrawingName.trim()) {
                  createDrawing.mutate({ name: newDrawingName.trim() });
                }
              }}
              autoFocus
            />
            <DialogFooter>
              <Button
                onClick={() => createDrawing.mutate({ name: newDrawingName.trim() })}
                disabled={!newDrawingName.trim() || createDrawing.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {drawings && drawings.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drawings.map((drawing) => (
            <Card key={drawing.id} className="group relative hover:bg-accent/50 transition-colors">
              <Link href={`/drawings/${drawing.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{drawing.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Updated{' '}
                    {formatDistanceToNow(new Date(drawing.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </CardContent>
              </Link>

              <div className="absolute right-2 top-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        setEditingDrawing({
                          id: drawing.id,
                          name: drawing.name,
                        });
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        deleteDrawing.mutate({ id: drawing.id });
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <FileImage className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">You don&#39;t have any drawings yet.</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Drawing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!editingDrawing} onOpenChange={(open) => !open && setEditingDrawing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Drawing</DialogTitle>
          </DialogHeader>
          <Input
            value={editingDrawing?.name ?? ''}
            onChange={(e) =>
              setEditingDrawing((prev) => (prev ? { ...prev, name: e.target.value } : null))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editingDrawing?.name.trim()) {
                updateDrawing.mutate({
                  id: editingDrawing.id,
                  name: editingDrawing.name.trim(),
                });
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              onClick={() => {
                if (editingDrawing?.name.trim()) {
                  updateDrawing.mutate({
                    id: editingDrawing.id,
                    name: editingDrawing.name.trim(),
                  });
                }
              }}
              disabled={!editingDrawing?.name.trim() || updateDrawing.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
