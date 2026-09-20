import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../config/awsBedrock';
import { env } from '../config/env';
import type { BedrockMessage } from '../types/bedrock.d';

const MODEL_ID = env.BEDROCK_MODEL_ID;

/**
 * Core invoke function — sends messages to AWS Bedrock and returns raw text.
 * Uses the Converse API (works with Nova, Llama3, Claude models uniformly).
 */
export async function invokeModel(
  systemPrompt: string,
  messages: BedrockMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  } = {}
): Promise<string> {
  // Convert our BedrockMessage format to SDK Message format
  const sdkMessages: Message[] = messages.map((m) => ({
    role: m.role,
    content: m.content.map((c) => ({ text: c.text } as ContentBlock)),
  }));

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: sdkMessages,
    inferenceConfig: {
      maxTokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.9,
    },
  });

  const response = await bedrockClient.send(command);

  // Extract text block from the ContentBlock union
  const contentBlocks = response.output?.message?.content ?? [];
  const textBlock = contentBlocks.find(
    (block): block is Extract<ContentBlock, { text: string }> => 'text' in block
  );

  if (!textBlock?.text) {
    throw new Error('Bedrock returned an empty response.');
  }

  return textBlock.text;
}

/**
 * Parses a raw Bedrock response that is expected to be a JSON object.
 * Strips markdown code fences if the model wraps the response in them.
 */
export function parseJSONResponse<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract JSON object from surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`Failed to parse Bedrock JSON response: ${raw.slice(0, 200)}`);
  }
}

/**
 * Convenience: invoke + parse JSON in one call.
 */
export async function invokeAndParse<T>(
  systemPrompt: string,
  userPrompt: string,
  conversationHistory: BedrockMessage[] = [],
  options?: { maxTokens?: number; temperature?: number }
): Promise<T> {
  const messages: BedrockMessage[] = [
    ...conversationHistory,
    { role: 'user', content: [{ type: 'text', text: userPrompt }] },
  ];

  const raw = await invokeModel(systemPrompt, messages, options);
  return parseJSONResponse<T>(raw);
}
