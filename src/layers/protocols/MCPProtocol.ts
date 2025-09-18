export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: TParams;
}

export interface JsonRpcSuccess<TResult = unknown> {
  jsonrpc: '2.0';
  id: string;
  result: TResult;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<TResult = unknown> =
  | JsonRpcSuccess<TResult>
  | JsonRpcError;

export type ProcedureHandler<TParams = unknown, TResult = unknown> = (
  params: TParams
) => Promise<TResult> | TResult;

export class MCPError extends Error {
  constructor(message: string, public readonly code = -32000, public readonly data?: unknown) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPServer {
  private readonly procedures = new Map<string, ProcedureHandler>();

  registerProcedure<TParams, TResult>(name: string, handler: ProcedureHandler<TParams, TResult>): void {
    this.procedures.set(name, handler as ProcedureHandler);
  }

  async handle(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (request.jsonrpc !== '2.0') {
      return this.error(request.id, -32600, 'Invalid JSON-RPC version');
    }

    const handler = this.procedures.get(request.method);

    if (!handler) {
      return this.error(request.id, -32601, `Method ${request.method} not found`);
    }

    try {
      const result = await handler(request.params);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      if (error instanceof MCPError) {
        return this.error(request.id, error.code, error.message, error.data);
      }

      return this.error(request.id, -32603, 'Internal MCP error');
    }
  }

  private error(id: string, code: number, message: string, data?: unknown): JsonRpcError {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data
      }
    };
  }
}

export class MCPClient {
  private static idCounter = 0;

  constructor(private readonly server: MCPServer, private readonly agentId: string) {}

  async call<TParams, TResult>(method: string, params: TParams): Promise<TResult> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: `${this.agentId}-${MCPClient.idCounter++}`,
      method,
      params
    };

    const response = await this.server.handle(request);

    if ('error' in response) {
      throw new MCPError(response.error.message, response.error.code, response.error.data);
    }

    return response.result as TResult;
  }
}
