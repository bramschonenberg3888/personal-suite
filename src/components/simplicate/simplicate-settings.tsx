'use client';

import { useState } from 'react';
import {
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';
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
  employeeId: string;
}

export function SimplicateSettings() {
  const utils = trpc.useUtils();

  // Track form edits separately from server state
  const [formEdits, setFormEdits] = useState<Partial<ConnectionFormState>>({});

  // Mapping state
  const [newProjectMapping, setNewProjectMapping] = useState({ client: '', projectId: '' });
  const [newHourTypeMapping, setNewHourTypeMapping] = useState({ type: '', hourTypeId: '' });

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

  const { data: hourTypes, isLoading: hourTypesLoading } = trpc.simplicate.hourTypes.list.useQuery(
    undefined,
    { enabled: !!connection?.apiKey && !!connection?.apiSecret }
  );

  const { data: employees } = trpc.simplicate.employees.list.useQuery(undefined, {
    enabled: !!connection?.apiKey && !!connection?.apiSecret,
  });

  const { data: projectMappings } = trpc.simplicate.mappings.list.useQuery({
    mappingType: 'project',
  });

  const { data: hourTypeMappings } = trpc.simplicate.mappings.list.useQuery({
    mappingType: 'hourtype',
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
      setNewProjectMapping({ client: '', projectId: '' });
      setNewHourTypeMapping({ type: '', hourTypeId: '' });
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
  const employeeId = formEdits.employeeId ?? connection?.employeeId ?? '';

  const hasChanges = Object.keys(formEdits).length > 0;

  const handleFieldChange = (field: keyof ConnectionFormState, value: string) => {
    setFormEdits((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConnection = () => {
    saveConnection.mutate({
      subdomain,
      apiKey: apiKey || undefined,
      apiSecret: apiSecret || undefined,
      employeeId: employeeId || undefined,
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
        mappingType: 'project',
      });
    }
  };

  const handleAddHourTypeMapping = () => {
    if (newHourTypeMapping.type && newHourTypeMapping.hourTypeId) {
      upsertMapping.mutate({
        notionValue: newHourTypeMapping.type,
        simplicateId: newHourTypeMapping.hourTypeId,
        mappingType: 'hourtype',
      });
    }
  };

  const isConnected = !!connection?.apiKey && !!connection?.apiSecret;
  const unmappedClients =
    filterOptions?.clients.filter((c) => !projectMappings?.some((m) => m.notionValue === c)) ?? [];
  const unmappedTypes =
    filterOptions?.types.filter((t) => !hourTypeMappings?.some((m) => m.notionValue === t)) ?? [];

  if (connectionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Connection Settings
          </CardTitle>
          <CardDescription>
            Configure your Simplicate API credentials. Get your API key and secret from Simplicate
            Settings → API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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

            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              {employees && employees.length > 0 ? (
                <Select
                  value={employeeId}
                  onValueChange={(value) => handleFieldChange('employeeId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} {e.function && `(${e.function})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => handleFieldChange('employeeId', e.target.value)}
                  placeholder="employee:abc123"
                />
              )}
              <p className="text-muted-foreground text-xs">
                Your employee ID in Simplicate (required for posting hours)
              </p>
            </div>
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

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSaveConnection}
              disabled={saveConnection.isPending || !hasChanges}
            >
              {saveConnection.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Connection'
              )}
            </Button>

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
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>

            {connectionTest && (
              <div className="flex items-center gap-2">
                {connectionTest.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-red-600">{connectionTest.error}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Project Mappings */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Client → Project Mappings
            </CardTitle>
            <CardDescription>
              Map your Notion clients to Simplicate projects. Hours will be posted to the mapped
              project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="flex gap-2">
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
                  setNewProjectMapping((prev) => ({ ...prev, projectId: value }))
                }
                disabled={projectsLoading}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select Simplicate project" />
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

              <Button
                size="icon"
                onClick={handleAddProjectMapping}
                disabled={
                  !newProjectMapping.client ||
                  !newProjectMapping.projectId ||
                  upsertMapping.isPending
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing mappings */}
            {projectMappings && projectMappings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notion Client</TableHead>
                    <TableHead>Simplicate Project</TableHead>
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
          </CardContent>
        </Card>
      )}

      {/* Hour Type Mappings */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Work Type → Hour Type Mappings
            </CardTitle>
            <CardDescription>
              Map your Notion work types to Simplicate hour types. This determines how hours are
              categorized.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {unmappedTypes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-muted-foreground text-sm">Unmapped types:</span>
                {unmappedTypes.map((type) => (
                  <Badge key={type} variant="outline">
                    {type}
                  </Badge>
                ))}
              </div>
            )}

            {/* Add new mapping */}
            <div className="flex gap-2">
              <Select
                value={newHourTypeMapping.type}
                onValueChange={(value) =>
                  setNewHourTypeMapping((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions?.types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-muted-foreground flex items-center">→</span>

              <Select
                value={newHourTypeMapping.hourTypeId}
                onValueChange={(value) =>
                  setNewHourTypeMapping((prev) => ({ ...prev, hourTypeId: value }))
                }
                disabled={hourTypesLoading}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select Simplicate hour type" />
                </SelectTrigger>
                <SelectContent>
                  {hourTypes?.map((hourType) => (
                    <SelectItem key={hourType.id} value={hourType.id}>
                      {hourType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="icon"
                onClick={handleAddHourTypeMapping}
                disabled={
                  !newHourTypeMapping.type ||
                  !newHourTypeMapping.hourTypeId ||
                  upsertMapping.isPending
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing mappings */}
            {hourTypeMappings && hourTypeMappings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Notion Work Type</TableHead>
                    <TableHead>Simplicate Hour Type</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourTypeMappings.map((mapping) => {
                    const hourType = hourTypes?.find((h) => h.id === mapping.simplicateId);
                    return (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.notionValue}</TableCell>
                        <TableCell>
                          {hourType ? (
                            hourType.label
                          ) : (
                            <span className="text-muted-foreground">{mapping.simplicateId}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteMapping.mutate({
                                notionValue: mapping.notionValue,
                                mappingType: 'hourtype',
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
          </CardContent>
        </Card>
      )}

      {/* Not connected message */}
      {!isConnected && !connectionLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Settings className="text-muted-foreground mx-auto h-12 w-12" />
            <h3 className="mt-4 text-lg font-semibold">Connect to Simplicate</h3>
            <p className="text-muted-foreground mt-2">
              Enter your API credentials above to configure mappings and push hours to Simplicate.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
