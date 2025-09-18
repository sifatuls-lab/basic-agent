import { BaseAgent, AgentResult, AgentTask } from '../BaseAgent';
import { MCPError } from '../../protocols/MCPProtocol';

interface SqlQueryPayload {
  query: string;
}

interface TableRow {
  [column: string]: string | number;
}

interface SqlExecutionResult {
  rows: TableRow[];
  explanation: string;
}

interface SqlTableStore {
  employees: TableRow[];
  sales: TableRow[];
}

export class SQLAgent extends BaseAgent {
  private readonly tables: SqlTableStore = {
    employees: [
      { id: 1, name: 'Aria', role: 'Researcher', location: 'Berlin' },
      { id: 2, name: 'Noah', role: 'Engineer', location: 'Paris' },
      { id: 3, name: 'Liam', role: 'Designer', location: 'London' }
    ],
    sales: [
      { id: 101, region: 'EMEA', revenue: 125000 },
      { id: 102, region: 'Americas', revenue: 174500 },
      { id: 103, region: 'APAC', revenue: 98000 }
    ]
  };

  constructor() {
    super({
      id: 'sql-agent',
      name: 'SQL Agent',
      description: 'Executes SQL-style analytics over structured datasets.',
      capabilities: ['sql', 'analytics', 'tabular-reasoning']
    });
  }

  protected registerProcedures(): void {
    this.registerProcedure<SqlQueryPayload, SqlExecutionResult>('executeSQL', ({ query }) => {
      if (!query?.trim()) {
        throw new MCPError('SQL query cannot be empty', 400);
      }

      return this.simulateQuery(query);
    });
  }

  async handleTask(task: AgentTask<SqlQueryPayload>): Promise<AgentResult<SqlExecutionResult>> {
    const result = await this.simulateQuery(task.payload.query);

    return {
      agentId: this.id,
      agentName: this.name,
      type: task.type,
      summary: `SQL execution completed with ${result.rows.length} row(s).`,
      result,
      metadata: {
        query: task.payload.query
      }
    };
  }

  private simulateQuery(query: string): SqlExecutionResult {
    const normalized = query.toLowerCase();

    if (normalized.includes('from employees')) {
      return {
        rows: this.tables.employees,
        explanation: 'Retrieved employee roster with roles and locations.'
      };
    }

    if (normalized.includes('from sales')) {
      const totalRevenue = this.tables.sales.reduce((sum, row) => sum + Number(row.revenue), 0);

      if (normalized.includes('sum') || normalized.includes('total')) {
        return {
          rows: [{ totalRevenue }],
          explanation: 'Aggregated total revenue across sales regions.'
        };
      }

      return {
        rows: this.tables.sales,
        explanation: 'Returned sales revenue by region.'
      };
    }

    return {
      rows: [],
      explanation: 'No matching in-memory dataset found for the provided SQL statement.'
    };
  }
}
