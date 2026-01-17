import { DrawingList } from '@/components/drawing/drawing-list';

export default function DrawingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drawings</h1>
        <p className="text-muted-foreground">Create and manage your Excalidraw drawings</p>
      </div>

      <DrawingList />
    </div>
  );
}
