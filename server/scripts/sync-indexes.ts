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

interface ModelEntry {
  name: string;
  model: any;
}

const DOMAIN_MODELS: ModelEntry[] = [
  { name: 'Brokerage', model: Brokerage },
  { name: 'User', model: User },
  { name: 'Lead', model: Lead },
  { name: 'Client', model: Client },
  { name: 'Document', model: DocumentModel },
  { name: 'Task', model: Task },
  { name: 'EmailTemplate', model: EmailTemplate },
  { name: 'PipelineTrigger', model: PipelineTrigger },
  { name: 'TriggerExecution', model: TriggerExecution },
  { name: 'Session', model: Session },
  { name: 'EmailLog', model: EmailLog },
  { name: 'EmailSuppression', model: EmailSuppression },
  { name: 'ActivityLog', model: ActivityLog },
];

export async function syncAllIndexes(options?: {
  closeConnection?: boolean;
}): Promise<{ success: boolean; results: Record<string, string[]> }> {
  console.log('--- MongoDB Index Synchronization ---');
  console.log(`Target: ${env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`);

  await connectDatabase();

  const results: Record<string, string[]> = {};
  let hadError = false;

  for (const { name, model } of DOMAIN_MODELS) {
    try {
      console.log(`Syncing indexes for collection: ${model.collection.name} (${name})...`);
      const syncResult = await model.syncIndexes();
      const existingIndexes = await model.collection.indexes();
      const indexNames = existingIndexes.map((idx: any) => idx.name || JSON.stringify(idx.key));
      results[name] = indexNames;
      console.log(
        `✓ ${name}: synced successfully (${indexNames.length} active indexes: ${indexNames.join(', ')})`
      );
      if (syncResult && Object.keys(syncResult).length > 0) {
        console.log(`  Sync diff details:`, syncResult);
      }
    } catch (err) {
      hadError = true;
      console.error(`✗ Error syncing indexes for ${name}:`, err);
    }
  }

  const shouldClose = options?.closeConnection ?? isDirectExecution;
  if (shouldClose) {
    await disconnectDatabase();
  }

  if (hadError) {
    console.error('--- Index Synchronization Finished with ERRORS ---');
    return { success: false, results };
  }

  console.log('--- All MongoDB Domain Model Indexes Synced Successfully ---');
  return { success: true, results };
}

// Direct execution guard
const isDirectExecution =
  process.argv[1]?.endsWith('sync-indexes.ts') ||
  process.argv[1]?.endsWith('sync-indexes.js');

if (isDirectExecution) {
  syncAllIndexes()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal error during index sync:', err);
      process.exit(1);
    });
}
