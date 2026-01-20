'use client';

import { useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { ExcalidrawWrapper } from './excalidraw-wrapper';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

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
  const [timestamp] = useState(() => Date.now());
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const { resolvedTheme } = useTheme();

  const updateDrawing = trpc.drawing.update.useMutation();
  const saveFilesMutation = trpc.drawing.saveFiles.useMutation();

  const isSaving = updateDrawing.isPending || saveFilesMutation.isPending;

  const handleSave = async () => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Convert readonly array to plain array for serialization
      const elementsArray = JSON.parse(JSON.stringify(elements));

      // Save elements and appState
      await updateDrawing.mutateAsync({
        id: drawingId,
        elements: elementsArray,
        appState: {
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
          gridModeEnabled: appState.gridModeEnabled,
        },
      });

      // Save files if any
      if (files && typeof files === 'object') {
        const fileEntries = Object.entries(files)
          .filter(([, file]: [string, any]) => file?.dataURL)
          .map(([fileId, file]: [string, any]) => ({
            fileId,
            mimeType: file.mimeType,
            dataUrl: file.dataURL,
          }));

        if (fileEntries.length > 0) {
          await saveFilesMutation.mutateAsync({
            drawingId,
            files: fileEntries,
          });
        }
      }
    } catch {
      // Error is handled by tRPC mutation state
    }
  };

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

  const handleLibraryChange = onLibraryChange
    ? (items: any) => onLibraryChange(items as unknown[])
    : undefined;

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-4 top-4 z-10">
        <Button onClick={handleSave} disabled={isSaving || !excalidrawAPI} size="sm">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>

      <ExcalidrawWrapper
        excalidrawAPI={setExcalidrawAPI}
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        initialData={
          {
            elements: initialElements,
            appState: cleanAppState,
            files: initialBinaryFiles,
            libraryItems: libraryItems,
          } as any
        }
        onLibraryChange={handleLibraryChange}
      />
    </div>
  );
}
