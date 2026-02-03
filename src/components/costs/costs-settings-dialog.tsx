'use client';

import { useState } from 'react';
import { Database, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/trpc/client';

export function NotionCostsSettings() {
  const utils = trpc.useUtils();
  const { data: connection } = trpc.costs.connection.get.useQuery();

  const [databaseId, setDatabaseId] = useState(connection?.costsDatabaseId ?? '');
  const [testDatabaseId, setTestDatabaseId] = useState('');

  const { data: validation, isLoading: validating } = trpc.costs.connection.validate.useQuery(
    { databaseId: testDatabaseId },
    { enabled: testDatabaseId.length > 0 }
  );

  const saveMutation = trpc.costs.connection.save.useMutation({
    onSuccess: () => {
      utils.costs.connection.get.invalidate();
    },
  });

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Notion Costs Connection
        </CardTitle>
        <CardDescription>Connect your Notion costs database to sync expense data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="costs-database-id">Database ID or URL</Label>
          <Input
            id="costs-database-id"
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
            <li>Share your costs database with the integration</li>
            <li>Copy the database URL and paste it above</li>
          </ol>
        </div>

        <div className="flex gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
