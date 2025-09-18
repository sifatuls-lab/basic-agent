import path from 'path';
import express from './lib/miniExpress';
import { CoordinatorAgent } from './layers/agents/CoordinatorAgent';

const app = express();
const coordinator = new CoordinatorAgent();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/message', async (req, res) => {
  const { sessionId, text, imageBase64, imagePrompt } = (req.body ?? {}) as {
    sessionId?: string;
    text?: string;
    imageBase64?: string;
    imagePrompt?: string;
  };

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  try {
    const response = await coordinator.handleUserInput({
      sessionId,
      text,
      imageBase64,
      imagePrompt
    });

    res.json(response);
  } catch (error) {
    console.error('Failed to process message', error);
    res.status(500).json({ error: 'Failed to process message', details: (error as Error).message });
  }
});

app.listen(port, () => {
  console.log(`AgentMaster server listening on port ${port}`);
});
