// ============================================================
// AWS Bedrock Type Declarations
// ============================================================

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{ type: 'text'; text: string }>;
}

export interface BedrockConverseInput {
  modelId: string;
  system?: Array<{ text: string }>;
  messages: BedrockMessage[];
  inferenceConfig?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

export interface BedrockConverseOutput {
  output: {
    message: {
      role: 'assistant';
      content: Array<{ text: string }>;
    };
  };
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'content_filtered';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ParsedBedrockResponse<T = unknown> {
  raw: string;
  parsed: T;
}
