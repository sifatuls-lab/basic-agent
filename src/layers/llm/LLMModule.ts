import { AgentResult } from '../agents/BaseAgent';
import { RetrievedMemory, SessionContext } from '../state/StateManager';

export interface LLMConfig {
  model: string;
  temperature?: number;
}

export class LLMModule {
  constructor(private readonly config: LLMConfig) {}

  generateResponse(prompt: string, context?: Record<string, unknown>): string {
    const contextSummary = context ? `\nContext: ${JSON.stringify(context)}` : '';
    return `LLM(${this.config.model}) response to: ${prompt}${contextSummary}`;
  }

  synthesize(
    userQuery: string,
    agentResults: AgentResult[],
    sessionContext: SessionContext,
    memories: RetrievedMemory[]
  ): string {
    const agentSections = agentResults
      .map((result) => {
        const serializedResult = JSON.stringify(result.result, null, 2);
        return `### ${result.agentName}\nSummary: ${result.summary}\nDetails: ${serializedResult}`;
      })
      .join('\n\n');

    const memorySection = memories.length
      ? `\n\n#### Retrieved memory\n${memories
          .map((memory) => `• (${memory.score.toFixed(2)}) ${memory.record.text}`)
          .join('\n')}`
      : '';

    const conversationSummary = sessionContext.messages
      .slice(-4)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n');

    return [
      `## User query`,
      userQuery,
      `\n## Conversation context`,
      conversationSummary || 'No prior context captured for this session.',
      `\n## Agent insights`,
      agentSections || 'No agent results were produced.',
      memorySection,
      `\n## Synthesized answer`,
      this.generateResponse(userQuery, {
        agents: agentResults.map((result) => result.agentName),
        memoryMatches: memories.length,
        sessionId: sessionContext.sessionId
      })
    ]
      .filter(Boolean)
      .join('\n');
  }
}
