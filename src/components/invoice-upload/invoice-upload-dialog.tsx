'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/client';
import { InvoicePreviewForm } from './invoice-preview-form';

interface InvoiceUploadDialogProps {
  onSuccess?: () => void;
}

type DialogState = 'idle' | 'parsing' | 'preview' | 'confirming' | 'success';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

interface ParsedData {
  name: string;
  amountExclVat: number;
  vat: number;
  invoiceDate: string;
  description?: string;
  vatRemarks?: string;
  confidence: number;
}

export function InvoiceUploadDialog({ onSuccess }: InvoiceUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialogState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseMutation = trpc.invoiceUpload.parse.useMutation({
    onSuccess: (data) => {
      setParsedData(data as ParsedData);
      setState('preview');
    },
    onError: (err) => {
      setError(err.message);
      setState('idle');
    },
  });

  const resetState = useCallback(() => {
    setState('idle');
    setParsedData(null);
    setError(null);
    setIsDragging(false);
  }, []);

  const confirmMutation = trpc.invoiceUpload.confirm.useMutation({
    onSuccess: () => {
      setState('success');
      setTimeout(() => {
        setOpen(false);
        resetState();
        onSuccess?.();
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
      setState('preview');
    },
  });

  const processFile = useCallback(
    (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Invalid file type. Please upload a PDF, JPG, PNG, or WebP file.');
        return;
      }

      if (file.size > MAX_SIZE) {
        setError('File is too large. Maximum size is 5MB.');
        return;
      }

      setState('parsing');

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        parseMutation.mutate({
          base64,
          fileName: file.name,
          mimeType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
        });
      };
      reader.onerror = () => {
        setError('Failed to read file.');
        setState('idle');
      };
      reader.readAsDataURL(file);
    },
    [parseMutation]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const handleConfirm = useCallback(
    (data: {
      name: string;
      amountExclVat: number;
      vat: number;
      invoiceDate: string;
      description?: string;
      vatRemarks?: string;
    }) => {
      setState('confirming');
      confirmMutation.mutate(data);
    },
    [confirmMutation]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Upload Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Invoice</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {state === 'idle' && (
          <div
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('invoice-file-input')?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('invoice-file-input')?.click();
              }
            }}
          >
            <Upload className="text-muted-foreground mb-3 h-8 w-8" />
            <p className="font-medium">Drop invoice here</p>
            <p className="text-muted-foreground mt-1 text-sm">PDF, JPG, PNG, or WebP (max 5MB)</p>
            <input
              id="invoice-file-input"
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {state === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-3">Analyzing invoice...</p>
          </div>
        )}

        {(state === 'preview' || state === 'confirming') && parsedData && (
          <InvoicePreviewForm
            data={parsedData}
            onConfirm={handleConfirm}
            onCancel={resetState}
            isSubmitting={state === 'confirming'}
          />
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            <p className="mt-3 font-medium">Invoice created successfully!</p>
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => {
                setOpen(false);
                resetState();
              }}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
