import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import {
  Brokerage,
  User,
  Lead,
  Client,
  Document as DocumentModel,
  Task,
  EmailTemplate,
  PipelineTrigger,
  TriggerExecution,
  Session,
  EmailLog,
  EmailSuppression,
  ActivityLog,
} from '../src/models/index.js';

interface ModelCount {
  collection: string;
  count: number;
}

export async function auditCollectionCounts(
  uri?: string,
  options?: { closeConnection?: boolean }
): Promise<ModelCount[]> {
  await connectDatabase(uri);
  const targetUri = uri || env.MONGODB_URI;
  console.log(`Auditing database collections at: ${targetUri.replace(/\/\/[^@]+@/, '//***@')}`);

  const models = [
    { name: 'Brokerages', model: Brokerage },
    { name: 'Users', model: User },
    { name: 'Leads', model: Lead },
    { name: 'Clients', model: Client },
    { name: 'Documents', model: DocumentModel },
    { name: 'Tasks', model: Task },
    { name: 'EmailTemplates', model: EmailTemplate },
    { name: 'PipelineTriggers', model: PipelineTrigger },
    { name: 'TriggerExecutions', model: TriggerExecution },
    { name: 'Sessions', model: Session },
    { name: 'EmailLogs', model: EmailLog },
    { name: 'EmailSuppressions', model: EmailSuppression },
    { name: 'ActivityLogs', model: ActivityLog },
  ];

  const summary: ModelCount[] = [];

  for (const { name, model } of models) {
    const count = await model.countDocuments();
    summary.push({ collection: name, count });
    console.log(`  - ${name.padEnd(20)}: ${count} documents`);
  }

  const shouldClose = options?.closeConnection ?? isDirectExecution;
  if (shouldClose) {
    await disconnectDatabase();
  }
  return summary;
}

const isDirectExecution =
  process.argv[1]?.endsWith('verify-backup.ts') ||
  process.argv[1]?.endsWith('verify-backup.js');

if (isDirectExecution) {
  const targetUri = process.argv[2];
  auditCollectionCounts(targetUri)
    .then((results) => {
      const totalDocs = results.reduce((acc, curr) => acc + curr.count, 0);
      console.log(`Total documents audited: ${totalDocs}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Audit failed:', err);
      process.exit(1);
    });
}
