import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { env } from './env';

const bedrockClient = new BedrockRuntimeClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  // Note: per-request timeouts are set at the command level via the SDK retry config
  maxAttempts: 2,
});

export { bedrockClient, ConverseCommand, ConverseStreamCommand };
export type { ConverseCommandInput };
