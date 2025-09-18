import { BaseAgent, AgentResult, AgentTask } from '../BaseAgent';

interface ImagePayload {
  imageData?: string;
  prompt?: string;
  operation: 'describe' | 'classify' | 'tag';
}

interface ImageResult {
  observations: string[];
  notes: string;
}

export class ImageAgent extends BaseAgent {
  constructor() {
    super({
      id: 'image-agent',
      name: 'Image Agent',
      description: 'Interfaces with vision APIs for captioning, tagging, and classification.',
      capabilities: ['vision', 'captioning', 'classification']
    });
  }

  protected registerProcedures(): void {
    this.registerProcedure<ImagePayload, ImageResult>('processImage', (payload) => {
      return this.simulateVision(payload);
    });
  }

  async handleTask(task: AgentTask<ImagePayload>): Promise<AgentResult<ImageResult>> {
    const result = this.simulateVision(task.payload);

    return {
      agentId: this.id,
      agentName: this.name,
      type: task.type,
      summary: 'Processed image task via simulated vision pipeline.',
      result,
      metadata: {
        prompt: task.payload.prompt,
        operation: task.payload.operation
      }
    };
  }

  private simulateVision(payload: ImagePayload): ImageResult {
    const baseObservations = [
      'Detected shapes and color palette indicative of a concept illustration.',
      'No OCR text extraction performed in the offline prototype.'
    ];

    if (payload.operation === 'classify') {
      baseObservations.push('Predicted label: synthetic-demo-object (confidence 0.42).');
    }

    if (payload.operation === 'tag') {
      baseObservations.push('Generated tags: prototype, vision, agent-master.');
    }

    if (payload.prompt) {
      baseObservations.push(`Applied user prompt: ${payload.prompt}`);
    }

    return {
      observations: baseObservations,
      notes: 'Stub implementation that stands in for an external vision API call.'
    };
  }
}
