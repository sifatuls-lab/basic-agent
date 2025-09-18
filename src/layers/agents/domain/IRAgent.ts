import { BaseAgent, AgentResult, AgentTask } from '../BaseAgent';

interface RetrievalPayload {
  query: string;
  topK?: number;
}

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

interface RetrievalResult {
  documents: KnowledgeDocument[];
  reasoning: string;
}

export class IRAgent extends BaseAgent {
  private readonly knowledgeBase: KnowledgeDocument[] = [
    {
      id: 'doc-1',
      title: 'Vector Databases Overview',
      content:
        'Vector databases index embeddings to enable similarity search for semantic retrieval and contextual memory.',
      tags: ['vectors', 'retrieval', 'memory']
    },
    {
      id: 'doc-2',
      title: 'A2A Protocol Design Notes',
      content:
        'Agent-to-agent (A2A) messaging enables delegation, progress tracking, and coordination across specialized workers.',
      tags: ['protocols', 'coordination']
    },
    {
      id: 'doc-3',
      title: 'MCP JSON-RPC Primer',
      content:
        'The Model Context Protocol (MCP) exposes tools, context, and memory through JSON-RPC endpoints backed by caches.',
      tags: ['mcp', 'tooling']
    }
  ];

  constructor() {
    super({
      id: 'ir-agent',
      name: 'IR Agent',
      description: 'Retrieves passages from unstructured knowledge bases.',
      capabilities: ['retrieval', 'knowledge-base', 'semantic-search']
    });
  }

  protected registerProcedures(): void {
    this.registerProcedure<RetrievalPayload, RetrievalResult>('retrieveDocuments', (payload) => {
      const documents = this.rankDocuments(payload.query, payload.topK ?? 2);

      return {
        documents,
        reasoning: `Selected ${documents.length} document(s) using keyword overlap scoring.`
      };
    });
  }

  async handleTask(task: AgentTask<RetrievalPayload>): Promise<AgentResult<RetrievalResult>> {
    const documents = this.rankDocuments(task.payload.query, task.payload.topK ?? 3);

    return {
      agentId: this.id,
      agentName: this.name,
      type: task.type,
      summary: `Retrieved ${documents.length} relevant knowledge document(s).`,
      result: {
        documents,
        reasoning: 'Keyword overlap scoring using a simple bag-of-words heuristic.'
      },
      metadata: {
        query: task.payload.query
      }
    };
  }

  private rankDocuments(query: string, topK: number): KnowledgeDocument[] {
    const keywords = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    const scored = this.knowledgeBase.map((doc) => {
      const haystack = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase();
      const score = keywords.reduce((acc, term) => (haystack.includes(term) ? acc + 1 : acc), 0);
      return { doc, score };
    });

    return scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((entry) => entry.doc);
  }
}
