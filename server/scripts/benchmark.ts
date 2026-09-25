import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import autocannon from 'autocannon';
import { createApp } from '../src/app.js';
import { Brokerage } from '../src/models/brokerage.model.js';
import { User } from '../src/models/user.model.js';
import { Lead } from '../src/models/lead.model.js';
import { Task } from '../src/models/task.model.js';
import { Document as DocumentModel } from '../src/models/document.model.js';
import { tokenService } from '../src/services/token.service.js';
import { hashPassword } from '../src/utils/password.js';

interface BenchmarkResultSummary {
  name: string;
  endpoint: string;
  method: string;
  requestsPerSec: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  totalRequests: number;
  errors: number;
  non2xx: number;
}

async function runBenchmark(): Promise<void> {
  console.log('====================================================');
  console.log('  LeadFlow Backend Performance & Load Benchmarking  ');
  console.log('====================================================\n');

  // 1. In-memory Mongo setup
  console.log('[1/4] Spinning up in-memory MongoDB instance...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  // 2. Seed baseline data
  console.log('[2/4] Seeding multi-tenant benchmark dataset...');
  const passwordHash = await hashPassword('Benchmark123!');

  const brokerageA = await Brokerage.create({
    name: 'Berlin Expat Mortgages',
    slug: 'berlin-expat',
    status: 'ACTIVE',
    webhookSecret: 'bench_webhook_secret_a123',
  });

  const brokerageB = await Brokerage.create({
    name: 'Munich Expat Advisory',
    slug: 'munich-expat',
    status: 'ACTIVE',
    webhookSecret: 'bench_webhook_secret_b456',
  });

  const advisorA = await User.create({
    brokerageId: brokerageA._id,
    name: 'Elena Advisor',
    email: 'elena@berlin-expat.de',
    passwordHash,
    role: 'ADVISOR',
    status: 'ACTIVE',
  });

  const tokenAdvisorA = tokenService.generateAccessToken({
    userId: advisorA._id.toString(),
    email: advisorA.email,
    role: advisorA.role,
    brokerageId: brokerageA._id.toString(),
  });

  // Seed 200 leads across pipeline stages
  const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
  const leadDocs = [];
  for (let i = 0; i < 200; i++) {
    leadDocs.push({
      brokerageId: brokerageA._id,
      firstName: `LeadFirst_${i}`,
      lastName: `LeadLast_${i}`,
      email: `lead_${i}@benchmark-domain.de`,
      status: stages[i % stages.length],
      source: 'WEBSITE',
      score: 50 + (i % 50),
      assignedTo: advisorA._id,
    });
  }
  await Lead.insertMany(leadDocs);

  // Seed 100 tasks
  const taskDocs = [];
  for (let i = 0; i < 100; i++) {
    taskDocs.push({
      brokerageId: brokerageA._id,
      title: `Follow up task #${i}`,
      status: i % 3 === 0 ? 'COMPLETED' : 'PENDING',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + (i % 2 === 0 ? -86400000 : 86400000)), // half overdue
      assignedTo: advisorA._id,
    });
  }
  await Task.insertMany(taskDocs);

  // Seed 100 documents
  const docDocs = [];
  for (let i = 0; i < 100; i++) {
    docDocs.push({
      brokerageId: brokerageA._id,
      title: `Payslip_${i}.pdf`,
      fileUrl: `https://ik.imagekit.io/bench/payslip_${i}.pdf`,
      fileKey: `key_${i}`,
      type: 'PAYSLIP',
      status: i % 2 === 0 ? 'VERIFIED' : 'PENDING',
      uploadedBy: advisorA._id,
    });
  }
  await DocumentModel.insertMany(docDocs);

  // 3. Start Express server on ephemeral port
  console.log('[3/4] Starting Express server on local ephemeral port...');
  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine server address');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Server listening at ${baseUrl}\n`);

  // 4. Run Autocannon benchmark suites
  console.log('[4/4] Executing Autocannon load benchmarks (5s per scenario)...');
  const results: BenchmarkResultSummary[] = [];

  // Helper runner
  async function benchmarkScenario(
    name: string,
    endpoint: string,
    method: 'GET' | 'POST',
    options: {
      headers?: Record<string, string>;
      body?: string;
      connections?: number;
      duration?: number;
    } = {}
  ): Promise<void> {
    process.stdout.write(`  Running: ${name} ... `);
    const duration = options.duration ?? 5;
    const connections = options.connections ?? 10;

    const res = await autocannon({
      url: `${baseUrl}${endpoint}`,
      method,
      headers: options.headers ?? {},
      body: options.body,
      connections,
      duration,
    });

    results.push({
      name,
      endpoint,
      method,
      requestsPerSec: Math.round(res.requests.average),
      latencyP50: res.latency.p50,
      latencyP95: res.latency.p97_5, // closest standard percentiles
      latencyP99: res.latency.p99,
      totalRequests: res.requests.total,
      errors: res.errors,
      non2xx: res.non2xx,
    });

    console.log(`DONE (${Math.round(res.requests.average)} req/s, p50: ${res.latency.p50}ms)`);
  }

  // Suite 1: Raw Health Check Baseline
  await benchmarkScenario('Baseline Routing Health Check', '/health', 'GET');

  // Suite 2: Pipeline Kanban Board Load
  await benchmarkScenario(
    'Pipeline Kanban Board (GET /pipeline)',
    '/api/leads/pipeline',
    'GET',
    {
      headers: {
        Authorization: `Bearer ${tokenAdvisorA}`,
      },
    }
  );

  // Suite 3: Filtered Lead Queries (Stage=QUALIFIED)
  await benchmarkScenario(
    'Filtered Lead Query (Stage Index)',
    '/api/leads?stage=QUALIFIED',
    'GET',
    {
      headers: {
        Authorization: `Bearer ${tokenAdvisorA}`,
      },
    }
  );

  // Suite 4: Task List Query (Due Date & Overdue)
  await benchmarkScenario(
    'Task List Query (Due Date Index & Virtuals)',
    '/api/tasks',
    'GET',
    {
      headers: {
        Authorization: `Bearer ${tokenAdvisorA}`,
      },
    }
  );

  // Suite 5: Document List Query
  await benchmarkScenario(
    'Document List Query (Brokerage Scoped)',
    '/api/documents',
    'GET',
    {
      headers: {
        Authorization: `Bearer ${tokenAdvisorA}`,
      },
    }
  );

  // Suite 6: Idempotent Webhook Duplicate Ingestion
  await benchmarkScenario(
    'Lead Webhook Idempotent Duplicate Ingestion',
    `/api/leads/webhook/${brokerageA._id}`,
    'POST',
    {
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': brokerageA.webhookSecret!,
      },
      body: JSON.stringify({
        firstName: 'Duplicate',
        lastName: 'BenchmarkLead',
        email: 'lead_0@benchmark-domain.de', // already exists in DB
        source: 'WEBSITE',
      }),
    }
  );

  // Suite 7: High-Throughput Unique Webhook Ingestion (50 connections burst)
  await benchmarkScenario(
    'High-Throughput Webhook Ingestion Burst (25 conn)',
    `/api/leads/webhook/${brokerageA._id}`,
    'POST',
    {
      connections: 25,
      duration: 5,
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': brokerageA.webhookSecret!,
      },
      body: JSON.stringify({
        firstName: 'Burst',
        lastName: 'LoadLead',
        email: 'lead_0@benchmark-domain.de', // idempotent duplicate
        source: 'CAMPAIGN',
      }),
    }
  );

  // Clean shutdown
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await mongoose.disconnect();
  await mongod.stop();

  // Print results table
  console.log('\n====================================================================================================');
  console.log('                                  PERFORMANCE BENCHMARK RESULTS                                     ');
  console.log('====================================================================================================');
  console.table(
    results.map((r) => ({
      Scenario: r.name,
      Endpoint: `${r.method} ${r.endpoint.length > 30 ? r.endpoint.slice(0, 27) + '...' : r.endpoint}`,
      'Req / Sec (Avg)': r.requestsPerSec,
      'p50 (ms)': r.latencyP50,
      'p95 (ms)': r.latencyP95,
      'p99 (ms)': r.latencyP99,
      'Total Requests': r.totalRequests,
      Errors: r.errors,
      'Non-2xx': r.non2xx,
    }))
  );
  console.log('====================================================================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
