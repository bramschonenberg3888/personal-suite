'use client';

import { useState } from 'react';
import { Settings, CheckCircle2, XCircle, Loader2, Plus, Trash2, Link2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/trpc/client';

// Form state type for tracking edits
interface ConnectionFormState {
  subdomain: string;
  apiKey: string;
  apiSecret: string;
  hoursTypeId: string;
}

/** Resolves a service name by fetching services for the project */
function ServiceName({
  projectId,
  serviceId,
  isConnected,
}: {
  projectId: string;
  serviceId: string;
  isConnected: boolean;
}) {
  const { data: services } = trpc.simplicate.services.list.useQuery(
    { projectId },
    { enabled: isConnected }
  );
  const service = services?.find((s) => s.id === serviceId);
  if (service) return <>{service.name}</>;
  return <span className="text-muted-foreground">{serviceId}</span>;
}

export function SimplicateSettings() {
  const utils = trpc.useUtils();

  // Track form edits separately from server state
  const [formEdits, setFormEdits] = useState<Partial<ConnectionFormState>>({});

  // Mapping state
  const [newProjectMapping, setNewProjectMapping] = useState({
    client: '',
    projectId: '',
    serviceId: '',
  });

  // Queries
  const { data: connection, isLoading: connectionLoading } =
    trpc.simplicate.connection.get.useQuery();

  const {
    data: connectionTest,
    refetch: testConnection,
    isFetching: testingConnection,
  } = trpc.simplicate.connection.test.useQuery(undefined, {
    enabled: false,
  });

  const { data: projects, isLoading: projectsLoading } = trpc.simplicate.projects.list.useQuery(
    undefined,
    { enabled: !!connection?.apiKey && !!connection?.apiSecret }
  );

  const { data: services, isLoading: servicesLoading } = trpc.simplicate.services.list.useQuery(
    { projectId: newProjectMapping.projectId },
    { enabled: !!newProjectMapping.projectId && !!connection?.apiKey && !!connection?.apiSecret }
  );

  const { data: hourTypes, isLoading: hourTypesLoading } = trpc.simplicate.hourTypes.list.useQuery(
    undefined,
    { enabled: !!connection?.apiKey && !!connection?.apiSecret }
  );

  const { data: projectMappings } = trpc.simplicate.mappings.list.useQuery({
    mappingType: 'project',
  });

  // Get available clients and types from revenue entries
  const { data: filterOptions } = trpc.revenue.entries.filterOptions.useQuery();

  // Mutations
  const saveConnection = trpc.simplicate.connection.save.useMutation({
    onSuccess: () => {
      setFormEdits({});
      utils.simplicate.connection.invalidate();
      utils.simplicate.projects.invalidate();
      utils.simplicate.hourTypes.invalidate();
      utils.simplicate.employees.invalidate();
    },
  });

  const upsertMapping = trpc.simplicate.mappings.upsert.useMutation({
    onSuccess: () => {
      utils.simplicate.mappings.invalidate();
      setNewProjectMapping({ client: '', projectId: '', serviceId: '' });
    },
  });

  const deleteMapping = trpc.simplicate.mappings.delete.useMutation({
    onSuccess: () => {
      utils.simplicate.mappings.invalidate();
    },
  });

  // Compute current form values (server data merged with local edits)
  const subdomain = formEdits.subdomain ?? connection?.subdomain ?? 'scex';
  const apiKey = formEdits.apiKey ?? connection?.apiKey ?? '';
  const apiSecret = formEdits.apiSecret ?? connection?.apiSecret ?? '';
  const hoursTypeId = formEdits.hoursTypeId ?? connection?.hoursTypeId ?? '';

  const hasChanges = Object.keys(formEdits).length > 0;

  const handleFieldChange = (field: keyof ConnectionFormState, value: string) => {
    setFormEdits((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConnection = () => {
    saveConnection.mutate({
      subdomain,
      apiKey: apiKey || undefined,
      apiSecret: apiSecret || undefined,
      hoursTypeId: hoursTypeId || undefined,
    });
  };

  const handleTestConnection = () => {
    testConnection();
  };

  const handleAddProjectMapping = () => {
    if (newProjectMapping.client && newProjectMapping.projectId) {
      upsertMapping.mutate({
        notionValue: newProjectMapping.client,
        simplicateId: newProjectMapping.projectId,
        simplicateServiceId: newProjectMapping.serviceId || undefined,
        mappingType: 'project',
      });
    }
  };

  const isConnected = !!connection?.apiKey && !!connection?.apiSecret;
  const unmappedClients =
    filterOptions?.clients.filter((c) => !projectMappings?.some((m) => m.notionValue === c)) ?? [];

  if (connectionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Simplicate Connection
        </CardTitle>
        <CardDescription>
          Configure your Simplicate API credentials. Get your API key and secret from Simplicate
          Settings → API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subdomain">Subdomain</Label>
          <Input
            id="subdomain"
            value={subdomain}
            onChange={(e) => handleFieldChange('subdomain', e.target.value)}
            placeholder="your-company"
          />
          <p className="text-muted-foreground text-xs">
            From: https://<strong>{subdomain}</strong>.simplicate.nl
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder="Enter API key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret</Label>
            <Input
              id="apiSecret"
              type="password"
              value={apiSecret}
              onChange={(e) => handleFieldChange('apiSecret', e.target.value)}
              placeholder="Enter API secret"
            />
          </div>
        </div>

        {isConnected && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Hours Type</Label>
              {hourTypes && hourTypes.length > 0 ? (
                <Select
                  value={hoursTypeId}
                  onValueChange={(value) => handleFieldChange('hoursTypeId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hours type" />
                  </SelectTrigger>
                  <SelectContent>
                    {hourTypes.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {hourTypesLoading ? 'Loading...' : 'No hour types found'}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Used for all hours entries pushed to Simplicate. Kilometers are pushed separately
                via the mileage endpoint.
              </p>
            </div>
          </div>
        )}

        {connectionTest && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              connectionTest.success
                ? 'bg-green-500/10 text-green-600'
                : 'bg-red-500/10 text-red-600'
            }`}
          >
            {connectionTest.success ? (
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="font-medium">Connection successful!</p>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Connection failed</p>
                  <p className="mt-1 text-xs opacity-80">{connectionTest.error}</p>
                </div>
              </>
            )}
          </div>
        )}

        {saveConnection.error && (
          <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-600">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {saveConnection.error.message}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testingConnection || !apiKey || !apiSecret}
          >
            {testingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleSaveConnection} disabled={saveConnection.isPending || !hasChanges}>
            {saveConnection.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>

        {/* Project Mappings */}
        {isConnected && (
          <>
            <div className="border-t pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4" />
                Client → Project Mappings
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Map your Notion clients to Simplicate projects. Hours will be posted to the mapped
                project.
              </p>
            </div>
            {unmappedClients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-muted-foreground text-sm">Unmapped clients:</span>
                {unmappedClients.map((client) => (
                  <Badge key={client} variant="outline">
                    {client}
                  </Badge>
                ))}
              </div>
            )}

            {/* Add new mapping */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={newProjectMapping.client}
                onValueChange={(value) =>
                  setNewProjectMapping((prev) => ({ ...prev, client: value }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions?.clients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-muted-foreground flex items-center">→</span>

              <Select
                value={newProjectMapping.projectId}
                onValueChange={(value) =>
                  setNewProjectMapping((prev) => ({ ...prev, projectId: value, serviceId: '' }))
                }
                disabled={projectsLoading}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                      {project.organization && ` (${project.organization})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={newProjectMapping.serviceId}
                onValueChange={(value) =>
                  setNewProjectMapping((prev) => ({ ...prev, serviceId: value }))
                }
                disabled={!newProjectMapping.projectId || servicesLoading}
              >
                <SelectTrigger className="w-64">
                  <SelectValue
                    placeholder={servicesLoading ? 'Loading services...' : 'Select service'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="icon"
                onClick={handleAddProjectMapping}
                disabled={
                  !newProjectMapping.client ||
                  !newProjectMapping.projectId ||
                  upsertMapping.isPending
                }
              >
                {upsertMapping.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {upsertMapping.error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                {upsertMapping.error.message}
              </div>
            )}

            {/* Existing mappings */}
            {projectMappings && projectMappings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notion Client</TableHead>
                    <TableHead>Simplicate Project</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectMappings.map((mapping) => {
                    const project = projects?.find((p) => p.id === mapping.simplicateId);
                    return (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.notionValue}</TableCell>
                        <TableCell>
                          {project ? (
                            <>
                              {project.name}
                              {project.organization && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  ({project.organization})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">{mapping.simplicateId}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping.simplicateServiceId ? (
                            <ServiceName
                              projectId={mapping.simplicateId}
                              serviceId={mapping.simplicateServiceId}
                              isConnected={isConnected}
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteMapping.mutate({
                                notionValue: mapping.notionValue,
                                mappingType: 'project',
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
