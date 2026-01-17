'use client';

import { useCallback, useState, useMemo } from 'react';
import { ExcalidrawWrapper } from './excalidraw-wrapper';
import { useDebounce } from '@/hooks/use-debounce';
import { trpc } from '@/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check } from 'lucide-react';

interface DrawingCanvasProps {
  drawingId: string;
  initialElements: unknown[];
  initialAppState?: Record<string, unknown> | null;
  initialFiles?: Record<string, { mimeType: string; dataUrl: string }>;
  libraryItems?: unknown[];
  // eslint-disable-next-line no-unused-vars
  onLibraryChange?: (items: unknown[]) => void;
}

export function DrawingCanvas({
  drawingId,
  initialElements,
  initialAppState,
  initialFiles,
  libraryItems,
  onLibraryChange,
}: DrawingCanvasProps) {
  // Use lazy initializer to avoid impure function call during render
  const [timestamp] = useState(() => Date.now());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const updateDrawing = trpc.drawing.update.useMutation({
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => setSaveStatus('error'),
  });

  const saveFiles = trpc.drawing.saveFiles.useMutation();

  const debouncedSave = useDebounce((elements: readonly any[], appState: any) => {
    updateDrawing.mutate({
      id: drawingId,
      elements: elements as unknown[],
      appState: appState
        ? {
            viewBackgroundColor: appState.viewBackgroundColor,
            currentItemStrokeColor: appState.currentItemStrokeColor,
            currentItemBackgroundColor: appState.currentItemBackgroundColor,
            currentItemFillStyle: appState.currentItemFillStyle,
            currentItemStrokeWidth: appState.currentItemStrokeWidth,
            currentItemStrokeStyle: appState.currentItemStrokeStyle,
            currentItemRoughness: appState.currentItemRoughness,
            currentItemOpacity: appState.currentItemOpacity,
            currentItemFontFamily: appState.currentItemFontFamily,
            currentItemFontSize: appState.currentItemFontSize,
            currentItemTextAlign: appState.currentItemTextAlign,
            currentItemStartArrowhead: appState.currentItemStartArrowhead,
            currentItemEndArrowhead: appState.currentItemEndArrowhead,
            currentItemRoundness: appState.currentItemRoundness,
            gridSize: appState.gridSize,
            gridStep: appState.gridStep,
            gridModeEnabled: appState.gridModeEnabled,
          }
        : undefined,
    });
  }, 1000);

  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      debouncedSave(elements, appState);

      // Handle file uploads
      if (files && typeof files === 'object') {
        const newFiles = Object.entries(files)

          .filter(([, file]: [string, any]) => file?.dataURL)

          .map(([fileId, file]: [string, any]) => ({
            fileId,
            mimeType: file.mimeType,
            dataUrl: file.dataURL,
          }));

        if (newFiles.length > 0) {
          saveFiles.mutate({
            drawingId,
            files: newFiles,
          });
        }
      }
    },
    [debouncedSave, drawingId, saveFiles]
  );

  // Convert initial files to Excalidraw format
  const initialBinaryFiles = useMemo(() => {
    if (!initialFiles) return undefined;
    return Object.fromEntries(
      Object.entries(initialFiles).map(([fileId, file]) => [
        fileId,
        {
          id: fileId,
          mimeType: file.mimeType,
          dataURL: file.dataUrl,
          created: timestamp,
        },
      ])
    );
  }, [initialFiles, timestamp]);

  // Clean up app state for Excalidraw
  const cleanAppState = initialAppState
    ? {
        viewBackgroundColor: (initialAppState.viewBackgroundColor as string) || '#ffffff',
      }
    : undefined;

  // Handle library changes

  const handleLibraryChange = onLibraryChange
    ? (items: any) => onLibraryChange(items as unknown[])
    : undefined;

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-4 top-4 z-10">
        {saveStatus === 'saving' && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </Badge>
        )}
        {saveStatus === 'saved' && (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
            <Check className="h-3 w-3" />
            Saved
          </Badge>
        )}
        {saveStatus === 'error' && (
          <Badge variant="destructive" className="gap-1">
            Error saving
          </Badge>
        )}
      </div>

      <ExcalidrawWrapper
        initialData={
          {
            elements: initialElements,
            appState: cleanAppState,
            files: initialBinaryFiles,
            libraryItems: libraryItems,
          } as any
        }
        onChange={handleChange}
        onLibraryChange={handleLibraryChange}
      />
    </div>
  );
}
