import crypto from 'crypto';

export interface MemoryRecord {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface RetrievedMemory {
  record: MemoryRecord;
  score: number;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface SessionContext {
  sessionId: string;
  messages: SessionMessage[];
  scratchpad: Record<string, unknown>;
}

class VectorDatabase {
  private readonly records: MemoryRecord[] = [];

  add(text: string, metadata?: Record<string, unknown>): MemoryRecord {
    const embedding = this.embed(text);
    const record: MemoryRecord = {
      id: crypto.randomUUID(),
      text,
      embedding,
      metadata
    };

    this.records.push(record);
    return record;
  }

  search(query: string, limit = 5): RetrievedMemory[] {
    if (!query.trim()) {
      return [];
    }

    const queryEmbedding = this.embed(query);

    return this.records
      .map((record) => ({
        record,
        score: this.cosineSimilarity(queryEmbedding, record.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private embed(text: string): number[] {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const vector = new Array(64).fill(0);

    tokens.forEach((token) => {
      const digest = crypto.createHash('md5').update(token).digest();
      const bucket = (digest[0] ?? 0) % vector.length;
      vector[bucket] += 1;
    });

    return vector;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dot / (magnitudeA * magnitudeB);
  }
}

class ContextCache {
  private readonly sessions = new Map<string, SessionContext>();

  get(sessionId: string): SessionContext {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        messages: [],
        scratchpad: {}
      });
    }

    return this.sessions.get(sessionId)!;
  }

  update(sessionId: string, updateFn: (context: SessionContext) => void): SessionContext {
    const context = this.get(sessionId);
    updateFn(context);
    return context;
  }
}

export class StateManager {
  private readonly vectorDb = new VectorDatabase();
  private readonly cache = new ContextCache();

  storeMemory(text: string, metadata?: Record<string, unknown>): MemoryRecord {
    return this.vectorDb.add(text, metadata);
  }

  recallMemories(query: string, limit = 5): RetrievedMemory[] {
    return this.vectorDb.search(query, limit);
  }

  appendMessage(sessionId: string, message: SessionMessage): SessionContext {
    return this.cache.update(sessionId, (context) => {
      context.messages.push(message);
    });
  }

  getSessionContext(sessionId: string): SessionContext {
    return this.cache.get(sessionId);
  }

  updateScratchpad(sessionId: string, patch: Record<string, unknown>): SessionContext {
    return this.cache.update(sessionId, (context) => {
      context.scratchpad = {
        ...context.scratchpad,
        ...patch
      };
    });
  }
}
