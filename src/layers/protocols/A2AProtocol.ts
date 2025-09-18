export interface AgentMessage<TPayload = unknown> {
  id: string;
  senderId: string;
  recipientId: string;
  conversationId: string;
  content: string;
  payload?: TPayload;
  timestamp: number;
}

export interface AgentEnvelope<TPayload = unknown> {
  message: AgentMessage<TPayload>;
  status: 'queued' | 'delivered' | 'error';
  error?: string;
}

export interface MessageQuery {
  conversationId?: string;
  recipientId?: string;
  senderId?: string;
  limit?: number;
}

export class A2AProtocol {
  private readonly transcripts: AgentEnvelope[] = [];

  sendMessage<TPayload>(message: AgentMessage<TPayload>): AgentEnvelope<TPayload> {
    const envelope: AgentEnvelope<TPayload> = {
      message,
      status: 'delivered'
    };

    this.transcripts.push(envelope);
    return envelope;
  }

  createMessage<TPayload>(
    senderId: string,
    recipientId: string,
    conversationId: string,
    content: string,
    payload?: TPayload
  ): AgentMessage<TPayload> {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId,
      recipientId,
      conversationId,
      content,
      payload,
      timestamp: Date.now()
    };
  }

  history(query?: MessageQuery): AgentEnvelope[] {
    const results = this.transcripts.filter((envelope) => {
      const { message } = envelope;

      if (query?.conversationId && message.conversationId !== query.conversationId) {
        return false;
      }

      if (query?.recipientId && message.recipientId !== query.recipientId) {
        return false;
      }

      if (query?.senderId && message.senderId !== query.senderId) {
        return false;
      }

      return true;
    });

    if (query?.limit) {
      return results.slice(-query.limit);
    }

    return results;
  }
}
