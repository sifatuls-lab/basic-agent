# AgentMaster (TypeScript Edition)

AgentMaster is a modular multi-agent system prototype built with TypeScript and an Express-style HTTP layer. The system mirrors the architecture described in the project brief: a conversational UI funnels requests to a coordinator that orchestrates multiple specialized agents (SQL, information retrieval, and vision) through Agent-to-Agent (A2A) messaging and a lightweight implementation of the Model Context Protocol (MCP).

> **Offline note**: The execution environment blocks external npm installs. To keep the prototype operational, a minimal Express-compatible server (`src/lib/miniExpress.ts`) is bundled in the repo. It exposes the subset of Express APIs used here (`use`, `get`, `post`, `listen`, `express.json`, `express.static`). Replacing it with the official package only requires adjusting the import.

## High-level architecture

```
┌─────────────┐      ┌────────────────────┐      ┌────────────────┐
│  Web UI     │ ---> │ Express-like Layer │ ---> │ Coordinator    │
│ (public/)   │      │  (TypeScript)      │      │   Agent        │
└─────────────┘      └────────────────────┘      └────────────────┘
                                                     │
                                 ┌───────────────────┴───────────────────┐
                                 │                                       │
                         ┌───────────────┐                       ┌───────────────┐
                         │   Protocols   │                       │   State Layer │
                         │ (A2A + MCP)   │                       │ (memory/cache)│
                         └───────────────┘                       └───────────────┘
                                 │                                       │
                 ┌───────────────┴───────────────┐         ┌────────────┴────────────┐
                 │        Agent Clients          │         │     LLM Synthesis       │
                 └───────────────┬───────────────┘         └────────────┬────────────┘
                                 │                                       │
                      ┌──────────┴──────────┐                    ┌───────┴─────────┐
                      │ Domain MCP Servers  │                    │  Response Draft │
                      │ SQL / IR / Vision   │                    │ (LLM Module)    │
                      └─────────────────────┘                    └────────────────┘
```

### Components

- **UI layer**: `public/index.html` provides a single-page conversational console. It displays assistant replies, debugging transcripts (A2A log, retrieved memories, agent results), and sends `/api/message` requests.
- **HTTP layer**: `src/index.ts` wires the Express-like server, static hosting, health check, and message endpoint.
- **Coordinator Agent**: `src/layers/agents/CoordinatorAgent.ts` evaluates task complexity, plans workflows, dispatches tasks via `AgentClient`, aggregates results, consults memory, and calls the LLM synthesizer.
- **Protocol layer**:
  - `src/layers/protocols/A2AProtocol.ts`: in-memory transcript of agent-to-agent messages.
  - `src/layers/protocols/MCPProtocol.ts`: JSON-RPC server/client implementation for tool calls.
- **State layer**: `src/layers/state/StateManager.ts` combines an in-memory vector database (hash-bucket embeddings + cosine similarity) and a session context cache (history + scratchpad).
- **Agents**: Located under `src/layers/agents/`.
  - `SQLAgent`: executes structured queries against demo tables.
  - `IRAgent`: ranks small knowledge documents with keyword overlap.
  - `ImageAgent`: stubs integration with an external vision API.
  - `GeneralAgent`: open-domain fallback using the bundled LLM module.
- **Agent clients**: `src/layers/clients/AgentClient.ts` bridges A2A and MCP for each agent, logging dispatch/completion events and merging JSON-RPC results with agent summaries.
- **LLM module**: `src/layers/llm/LLMModule.ts` emulates GPT-4o-mini behavior for synthesis, formatting agent outputs, memories, and conversation snippets into a final Markdown answer.

## Data flow (text requests)

1. The UI sends `{ sessionId, text }` to `/api/message`.
2. The server forwards the payload to the coordinator.
3. The coordinator logs the user message, recalls semantic memories, and determines intents/complexity.
4. Planned tasks are executed through MCP-wrapped agents. Agent-to-agent messages record dispatch/completion.
5. Results and retrieved memories feed the LLM module, which crafts a synthesized Markdown reply.
6. The coordinator stores the new memory, updates the session context, and returns the structured response to the UI.

Image payloads trigger the `image.process` task and are routed to the vision agent (stub). Multiple intents in a single message upgrade the workflow to "complex" orchestration.

## Getting started

```bash
# Build the TypeScript sources
npm run build

# Start the server (listens on port 3000 by default)
npm start
```

Then open `http://localhost:3000` to try the conversational console. The debug drawer shows which agents were invoked, the MCP transcript, and any semantic memory hits.

## Project structure

```
public/                # Conversational UI
src/
  index.ts             # Express-like bootstrap + routing
  lib/miniExpress.ts   # Offline-friendly Express subset
  layers/
    agents/
      CoordinatorAgent.ts
      GeneralAgent.ts
      domain/
        SQLAgent.ts
        IRAgent.ts
        ImageAgent.ts
    clients/
      AgentClient.ts
    llm/
      LLMModule.ts
    protocols/
      A2AProtocol.ts
      MCPProtocol.ts
    state/
      StateManager.ts
```

## Next steps / extensions

- Swap `miniExpress` with the official Express package once npm access is restored.
- Replace the stubbed LLM module with actual GPT-4o mini invocations and integrate G-Eval scoring.
- Expand MCP tooling with additional domain agents and persistence-backed vector stores.
- Parallelize agent execution and add richer error recovery / retry strategies in the coordinator.
