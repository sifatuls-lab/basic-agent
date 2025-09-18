import { A2AProtocol, AgentEnvelope } from '../protocols/A2AProtocol';
import { AgentClient } from '../clients/AgentClient';
import { AgentResult, AgentTask } from './BaseAgent';
import { SQLAgent } from './domain/SQLAgent';
import { IRAgent } from './domain/IRAgent';
import { ImageAgent } from './domain/ImageAgent';
import { GeneralAgent } from './GeneralAgent';
import { MCPClient } from '../protocols/MCPProtocol';
import { StateManager, RetrievedMemory, SessionContext } from '../state/StateManager';
import { LLMModule } from '../llm/LLMModule';

export interface UserInput {
  sessionId: string;
  text?: string;
  imageBase64?: string;
  imagePrompt?: string;
}

export interface CoordinatorResponse {
  answer: string;
  agentResults: AgentResult[];
  a2aTranscript: AgentEnvelope[];
  retrievedMemories: RetrievedMemory[];
  sessionContext: SessionContext;
}

export class CoordinatorAgent {
  private readonly protocol = new A2AProtocol();
  private readonly stateManager: StateManager;
  private readonly llm: LLMModule;
  private readonly agentRegistry = new Map<string, AgentClient>();

  constructor() {
    this.stateManager = new StateManager();
    this.llm = new LLMModule({ model: 'gpt-4o-mini', temperature: 0.3 });
    this.registerAgents();
  }

  async handleUserInput(input: UserInput): Promise<CoordinatorResponse> {
    const { sessionId } = input;
    const userContent = input.text ?? '[image query]';

    this.stateManager.appendMessage(sessionId, {
      role: 'user',
      content: userContent,
      timestamp: Date.now()
    });

    const detectedIntents = this.detectIntents(input);
    const complexity = this.evaluateComplexity(userContent, detectedIntents);
    const tasks = this.planTasks(input, detectedIntents, complexity);

    const retrievedMemories = this.stateManager.recallMemories(userContent, 3);
    this.stateManager.updateScratchpad(sessionId, {
      lastDetectedIntents: detectedIntents,
      complexity
    });

    const agentResults: AgentResult[] = [];
    const conversationId = `${sessionId}-${Date.now()}`;

    for (const task of tasks) {
      const client = this.agentRegistry.get(task.type);
      if (!client) {
        continue;
      }

      try {
        const result = await client.execute(task, conversationId);
        agentResults.push(result);
      } catch (error) {
        agentResults.push({
          agentId: 'coordinator',
          agentName: 'Coordinator',
          type: task.type,
          summary: 'Task failed during orchestration.',
          result: {
            error: (error as Error).message
          }
        });
      }
    }

    if (agentResults.length === 0) {
      const fallbackClient = this.agentRegistry.get('general.answer');
      if (fallbackClient) {
        const result = await fallbackClient.execute(
          {
            type: 'general.answer',
            payload: {
              question: userContent,
              context: 'Fallback execution because no domain agents ran.'
            }
          },
          conversationId
        );
        agentResults.push(result);
      }
    }

    const sessionContext = this.stateManager.getSessionContext(sessionId);
    const synthesized = this.llm.synthesize(userContent, agentResults, sessionContext, retrievedMemories);

    this.stateManager.appendMessage(sessionId, {
      role: 'assistant',
      content: synthesized,
      timestamp: Date.now()
    });

    this.stateManager.storeMemory(userContent, {
      sessionId,
      complexity,
      agents: agentResults.map((result) => result.agentId)
    });

    return {
      answer: synthesized,
      agentResults,
      a2aTranscript: this.protocol.history({ conversationId }),
      retrievedMemories,
      sessionContext
    };
  }

  private registerAgents(): void {
    const sqlAgent = new SQLAgent();
    const irAgent = new IRAgent();
    const imageAgent = new ImageAgent();
    const generalAgent = new GeneralAgent(this.llm);

    this.agentRegistry.set('sql.query', this.createClient(sqlAgent));
    this.agentRegistry.set('ir.retrieve', this.createClient(irAgent));
    this.agentRegistry.set('image.process', this.createClient(imageAgent));
    this.agentRegistry.set('general.answer', this.createClient(generalAgent));
  }

  private createClient(agent: SQLAgent | IRAgent | ImageAgent | GeneralAgent): AgentClient {
    const client = new MCPClient(agent.mcpServer, agent.id);
    return new AgentClient(agent, this.protocol, client);
  }

  private detectIntents(input: UserInput): string[] {
    const text = (input.text ?? '').toLowerCase();
    const intents = new Set<string>();

    if (/(sql|database|table|query)/.test(text)) {
      intents.add('sql.query');
    }

    if (/(document|knowledge|article|research|context)/.test(text)) {
      intents.add('ir.retrieve');
    }

    if (input.imageBase64 || /(image|picture|vision|photo)/.test(text)) {
      intents.add('image.process');
    }

    if (intents.size === 0) {
      intents.add('general.answer');
    }

    return Array.from(intents);
  }

  private evaluateComplexity(message: string, intents: string[]): 'simple' | 'complex' {
    const tokenCount = message.trim().split(/\s+/).filter(Boolean).length;
    const hasCoordinator = /(and|then|combine|together|also|pipeline|workflow)/i.test(message);
    return intents.length > 1 || tokenCount > 20 || hasCoordinator ? 'complex' : 'simple';
  }

  private planTasks(
    input: UserInput,
    intents: string[],
    complexity: 'simple' | 'complex'
  ): AgentTask[] {
    if (complexity === 'simple') {
      const primaryIntent = intents[0] ?? 'general.answer';
      return [this.createTask(primaryIntent, input)];
    }

    return intents.map((intent) => this.createTask(intent, input));
  }

  private createTask(intent: string, input: UserInput): AgentTask {
    switch (intent) {
      case 'sql.query':
        return {
          type: 'sql.query',
          payload: {
            query: input.text ?? 'SELECT * FROM sales'
          }
        };
      case 'ir.retrieve':
        return {
          type: 'ir.retrieve',
          payload: {
            query: input.text ?? 'Retrieve relevant documents'
          }
        };
      case 'image.process':
        return {
          type: 'image.process',
          payload: {
            imageData: input.imageBase64,
            prompt: input.imagePrompt ?? input.text,
            operation: 'describe'
          }
        };
      case 'general.answer':
      default:
        return {
          type: 'general.answer',
          payload: {
            question: input.text ?? 'Provide a helpful response',
            context: input.imageBase64 ? 'Image provided by the user.' : undefined
          }
        };
    }
  }
}
