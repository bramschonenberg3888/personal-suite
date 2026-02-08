import type { StepRecord, WorkflowContext } from './types';

interface PipelineStep {
  name: string;
  // eslint-disable-next-line no-unused-vars
  fn: (variables: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface PipelineResult<TContext extends Record<string, unknown>> {
  context: WorkflowContext<TContext>;
  steps: StepRecord[];
}

interface Pipeline<TContext extends Record<string, unknown>> {
  step: <TOutput extends Record<string, unknown>>(
    // eslint-disable-next-line no-unused-vars
    name: string,
    // eslint-disable-next-line no-unused-vars
    fn: (variables: TContext) => Promise<TOutput>
  ) => Pipeline<TContext & TOutput>;
  // eslint-disable-next-line no-unused-vars
  execute: (initialVariables: TContext) => Promise<PipelineResult<TContext>>;
}

export function createPipeline<TContext extends Record<string, unknown> = Record<string, unknown>>(
  id: string
): Pipeline<TContext> {
  const steps: PipelineStep[] = [];

  function buildPipeline<T extends Record<string, unknown>>(): Pipeline<T> {
    return {
      step<TOutput extends Record<string, unknown>>(
        name: string,
        // eslint-disable-next-line no-unused-vars
        fn: (variables: T) => Promise<TOutput>
      ): Pipeline<T & TOutput> {
        steps.push({
          name,
          fn: fn as (_vars: Record<string, unknown>) => Promise<Record<string, unknown>>,
        });
        return buildPipeline<T & TOutput>();
      },

      async execute(initialVariables: T): Promise<PipelineResult<T>> {
        const context: WorkflowContext<T> = {
          id,
          variables: { ...initialVariables },
          startedAt: new Date(),
        };

        const stepRecords: StepRecord[] = [];

        for (const step of steps) {
          const record: StepRecord = {
            name: step.name,
            status: 'running',
            startedAt: new Date(),
          };
          stepRecords.push(record);

          try {
            const output = await step.fn(context.variables as Record<string, unknown>);
            Object.assign(context.variables, output);
            record.status = 'completed';
            record.completedAt = new Date();
          } catch (error) {
            record.status = 'failed';
            record.completedAt = new Date();
            record.error = error instanceof Error ? error.message : String(error);
            throw error;
          }
        }

        context.completedAt = new Date();
        return { context, steps: stepRecords };
      },
    };
  }

  return buildPipeline<TContext>();
}
