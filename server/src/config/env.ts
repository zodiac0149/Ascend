import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('5001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),

  // Supabase
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(10, 'SUPABASE_ANON_KEY is required'),

  // AWS Bedrock
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().min(10, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(10, 'AWS_SECRET_ACCESS_KEY is required'),
  BEDROCK_MODEL_ID: z.string().default('amazon.nova-pro-v1:0'),

  // Murf AI TTS
  MURF_API_KEY: z.string().min(10, 'MURF_API_KEY is required'),
  MURF_VOICE_ID: z.string().default('en-US-iris'),

  // Deepgram STT (optional)
  DEEPGRAM_API_KEY: z.string().optional(),

  // AWS S3 (optional)
  S3_BUCKET_NAME: z.string().optional(),
  S3_REGION: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (err) {
  if (err instanceof z.ZodError) {
    const missingVars = err.errors.map((e) => `  • ${e.path.join('.')}: ${e.message}`).join('\n');
    console.error(`\n❌ Invalid environment variables:\n${missingVars}\n`);
    process.exit(1);
  }
  throw err;
}

export { env };
