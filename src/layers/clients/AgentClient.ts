import { AgentTask, AgentResult, BaseAgent } from '../agents/BaseAgent';
import { MCPClient } from '../protocols/MCPProtocol';
import { A2AProtocol } from '../protocols/A2AProtocol';

export class AgentClient {
  constructor(
    private readonly agent: BaseAgent,
    private readonly protocol: A2AProtocol,
    private readonly client: MCPClient
  ) {}

  async execute(task: AgentTask, conversationId: string): Promise<AgentResult> {
    this.protocol.sendMessage(
      this.protocol.createMessage('coordinator', this.agent.id, conversationId, `Dispatching ${task.type}`)
    );

    try {
      const method = this.resolveMethod(task.type);
      const rpcResult = await this.client.call(method, task.payload);
      const agentResult = await this.agent.handleTask(task);
      agentResult.metadata = {
        ...(agentResult.metadata ?? {}),
        rpcMethod: method,
        rpcEcho: rpcResult
      };

      this.protocol.sendMessage(
        this.protocol.createMessage(
          this.agent.id,
          'coordinator',
          conversationId,
          `Completed ${task.type}`
        )
      );

      return agentResult;
    } catch (error) {
      this.protocol.sendMessage(
        this.protocol.createMessage(
          this.agent.id,
          'coordinator',
          conversationId,
          `Failed ${task.type}: ${(error as Error).message}`
        )
      );
      throw error;
    }
  }

  private resolveMethod(taskType: string): string {
    switch (taskType) {
      case 'sql.query':
        return 'executeSQL';
      case 'ir.retrieve':
        return 'retrieveDocuments';
      case 'image.process':
        return 'processImage';
      case 'general.answer':
        return 'answerQuestion';
      default:
        throw new Error(`Unsupported task type: ${taskType}`);
    }
  }
}
