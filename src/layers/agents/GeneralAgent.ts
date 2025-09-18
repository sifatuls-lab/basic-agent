import { BaseAgent, AgentResult, AgentTask } from './BaseAgent';
import { LLMModule } from '../llm/LLMModule';

interface GeneralQueryPayload {
  question: string;
  context?: string;
}

interface GeneralAnswer {
  answer: string;
  reasoning: string;
}

export class GeneralAgent extends BaseAgent {
  constructor(private readonly llm: LLMModule) {
    super({
      id: 'general-agent',
      name: 'Generalist Agent',
      description: 'Handles open-domain queries and acts as a fallback responder.',
      capabilities: ['open-domain', 'fallback', 'summarization']
    });
  }

  protected registerProcedures(): void {
    this.registerProcedure<GeneralQueryPayload, GeneralAnswer>('answerQuestion', (payload) => {
      return this.produceAnswer(payload);
    });
  }

  async handleTask(task: AgentTask<GeneralQueryPayload>): Promise<AgentResult<GeneralAnswer>> {
    const result = this.produceAnswer(task.payload);

    return {
      agentId: this.id,
      agentName: this.name,
      type: task.type,
      summary: 'Generated open-domain response with fallback logic.',
      result,
      metadata: {
        question: task.payload.question
      }
    };
  }

  private produceAnswer(payload: GeneralQueryPayload): GeneralAnswer {
    const answer = this.llm.generateResponse(payload.question, {
      context: payload.context,
      agent: this.name
    });

    return {
      answer,
      reasoning: 'Generated using the configured LLM module with provided context.'
    };
  }
}
