export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface StepRecord {
  name: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkflowContext<
  TVariables extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  variables: TVariables;
  startedAt: Date;
  completedAt?: Date;
}

export type StepFunction<
  TInput extends Record<string, unknown>,
  TOutput extends Record<string, unknown>,
  // eslint-disable-next-line no-unused-vars
> = (variables: TInput) => Promise<TOutput>;
