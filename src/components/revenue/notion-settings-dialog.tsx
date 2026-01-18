'use client';

import { useState } from 'react';
import { Settings, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/trpc/client';

interface NotionSettingsDialogProps {
  trigger?: React.ReactNode;
}

export function NotionSettingsDialog({ trigger }: NotionSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [databaseId, setDatabaseId] = useState('');
  const [testDatabaseId, setTestDatabaseId] = useState('');

  const utils = trpc.useUtils();
  const { data: connection } = trpc.revenue.connection.get.useQuery();

  const { data: validation, isLoading: validating } = trpc.revenue.connection.validate.useQuery(
    { databaseId: testDatabaseId },
    { enabled: testDatabaseId.length > 0 }
  );

  const saveMutation = trpc.revenue.connection.save.useMutation({
    onSuccess: () => {
      utils.revenue.connection.get.invalidate();
      setOpen(false);
    },
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && connection?.databaseId) {
      setDatabaseId(connection.databaseId);
    }
  };

  const handleTest = () => {
    setTestDatabaseId(databaseId);
  };

  const handleSave = () => {
    saveMutation.mutate({ databaseId });
  };

  const extractDatabaseId = (input: string): string => {
    // Handle full Notion URLs
    const urlMatch = input.match(/([a-f0-9]{32})/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Handle UUID format
    const uuidMatch = input.match(/([a-f0-9-]{36})/);
    if (uuidMatch) {
      return uuidMatch[1].replace(/-/g, '');
    }
    return input;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const extracted = extractDatabaseId(e.target.value);
    setDatabaseId(extracted);
    setTestDatabaseId(''); // Reset validation state
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notion Connection</DialogTitle>
          <DialogDescription>
            Connect your Notion time tracking database to sync revenue data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="database-id" className="text-sm font-medium">
              Database ID or URL
            </label>
            <Input
              id="database-id"
              placeholder="Enter Notion database ID or paste URL"
              value={databaseId}
              onChange={handleInputChange}
            />
            <p className="text-muted-foreground text-xs">
              You can paste the full Notion URL or just the database ID.
            </p>
          </div>

          {validation && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                validation.valid ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
              }`}
            >
              {validation.valid ? (
                <>
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Connection successful!</p>
                    <p className="mt-1 text-xs opacity-80">
                      Found {validation.properties?.length ?? 0} matching properties
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Connection failed</p>
                    <p className="mt-1 text-xs opacity-80">{validation.error}</p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="text-muted-foreground rounded-md bg-muted p-3 text-xs">
            <p className="mb-2 font-medium">Setup instructions:</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>
                Create a Notion integration at{' '}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  notion.so/my-integrations
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Share your time tracking database with the integration</li>
              <li>Copy the database URL and paste it above</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleTest} disabled={!databaseId || validating}>
            {validating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleSave} disabled={!validation?.valid || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
