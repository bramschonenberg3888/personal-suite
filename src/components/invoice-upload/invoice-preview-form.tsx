'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InvoicePreviewFormProps {
  data: {
    name: string;
    amountExclVat: number;
    vat: number;
    invoiceDate: string;
    description?: string;
    vatRemarks?: string;
    vatSection?: string;
    confidence: number;
  };
  onConfirm: (_data: {
    name: string;
    amountExclVat: number;
    vat: number;
    invoiceDate: string;
    description?: string;
    vatRemarks?: string;
    vatSection?: string;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function InvoicePreviewForm({
  data,
  onConfirm,
  onCancel,
  isSubmitting,
}: InvoicePreviewFormProps) {
  const [name, setName] = useState(data.name);
  const [amountExclVat, setAmountExclVat] = useState(data.amountExclVat);
  const [vat, setVat] = useState(data.vat);
  const [invoiceDate, setInvoiceDate] = useState(data.invoiceDate);
  const [description, setDescription] = useState(data.description ?? '');
  const [vatRemarks, setVatRemarks] = useState(data.vatRemarks ?? '');
  const [vatSection, setVatSection] = useState(data.vatSection ?? '');

  const total = amountExclVat + vat;

  const handleSubmit = () => {
    onConfirm({
      name,
      amountExclVat,
      vat,
      invoiceDate,
      description: description || undefined,
      vatRemarks: vatRemarks || undefined,
      vatSection: vatSection || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {data.confidence >= 0.8 && (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">High confidence</Badge>
        )}
        {data.confidence >= 0.5 && data.confidence < 0.8 && (
          <Badge className="bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-300">
            Medium confidence
          </Badge>
        )}
        {data.confidence < 0.5 && (
          <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
            Low confidence
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="amountExclVat">Amount (excl. VAT)</Label>
            <Input
              id="amountExclVat"
              type="number"
              step="0.01"
              value={amountExclVat}
              onChange={(e) => setAmountExclVat(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="vat">VAT</Label>
            <Input
              id="vat"
              type="number"
              step="0.01"
              value={vat}
              onChange={(e) => setVat(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-sm">
          Total:{' '}
          {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(total)}
        </p>

        <div>
          <Label htmlFor="invoiceDate">Invoice Date</Label>
          <Input
            id="invoiceDate"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="vatRemarks">VAT Remarks</Label>
          <Textarea
            id="vatRemarks"
            value={vatRemarks}
            onChange={(e) => setVatRemarks(e.target.value)}
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="vatSection">BTW Sectie</Label>
          <Select value={vatSection} onValueChange={setVatSection}>
            <SelectTrigger id="vatSection">
              <SelectValue placeholder="Kies sectie..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4a">4a – Buiten EU (verleggingsregeling)</SelectItem>
              <SelectItem value="5b Voorbelasting">5b Voorbelasting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create in Notion'
          )}
        </Button>
      </div>
    </div>
  );
}
