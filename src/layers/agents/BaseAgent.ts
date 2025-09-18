import { MCPServer, ProcedureHandler } from '../protocols/MCPProtocol';

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

export interface AgentTask<TPayload = unknown> {
  type: string;
  payload: TPayload;
  context?: Record<string, unknown>;
}

export interface AgentResult<TResult = unknown> {
  agentId: string;
  agentName: string;
  type: string;
  summary: string;
  result: TResult;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent {
  protected readonly server = new MCPServer();

  protected constructor(protected readonly profile: AgentProfile) {
    this.registerProcedures();
  }

  get id(): string {
    return this.profile.id;
  }

  get name(): string {
    return this.profile.name;
  }

  get description(): string {
    return this.profile.description;
  }

  get capabilities(): string[] {
    return this.profile.capabilities;
  }

  get mcpServer(): MCPServer {
    return this.server;
  }

  protected registerProcedure<TParams, TResult>(
    name: string,
    handler: ProcedureHandler<TParams, TResult>
  ): void {
    this.server.registerProcedure(name, handler);
  }

  protected abstract registerProcedures(): void;

  abstract handleTask(task: AgentTask): Promise<AgentResult>;
}
