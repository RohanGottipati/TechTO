/**
 * Wire-level types for the Backboard REST API (https://app.backboard.io/api),
 * confirmed against the published API reference. Field names intentionally
 * mirror the API's snake_case; ./client.ts adapts these to ergonomic
 * camelCase types for the rest of the app.
 */

export type BackboardRunStatusWire =
  | "COMPLETED"
  | "REQUIRES_ACTION"
  | "IN_PROGRESS"
  | "FAILED"
  | "CANCELLED";

export interface BackboardToolParameterSchemaWire {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, unknown>;
  items?: Record<string, unknown>;
}

export interface BackboardToolDefinitionWire {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: {
      type: "object";
      properties: Record<string, BackboardToolParameterSchemaWire>;
      required?: string[];
    };
  };
}

export interface BackboardToolCallWire {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

export interface BackboardThinkingConfigWire {
  effort?: "low" | "medium" | "high" | "max";
  budget_tokens?: number;
  max_tokens?: number;
  exclude_reasoning?: boolean;
}

export type BackboardMemoryModeWire = "Auto" | "Readonly" | "off";
export type BackboardWebSearchModeWire = "Auto" | "off";

export interface SendMessageRequestWire {
  content: string;
  thread_id?: string;
  assistant_id?: string;
  system_prompt?: string;
  llm_provider?: string;
  model_name?: string;
  stream?: boolean;
  tools?: BackboardToolDefinitionWire[];
  thinking?: BackboardThinkingConfigWire;
  memory?: BackboardMemoryModeWire;
  memory_response_citation?: boolean;
  web_search?: BackboardWebSearchModeWire;
  json_output?: boolean;
  send_to_llm?: string;
  metadata?: string;
}

export interface RetrievedMemoryWire {
  id: string;
  memory: string;
  score: number;
}

export interface MessageResponseWire {
  message: string;
  thread_id: string;
  timestamp: string;
  assistant_id?: string | null;
  content?: string | null;
  message_id?: string | null;
  role?: string | null;
  status?: BackboardRunStatusWire | string | null;
  tool_calls?: BackboardToolCallWire[] | null;
  run_id?: string | null;
  reasoning?: string | null;
  model_provider?: string | null;
  model_name?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  retrieved_memories?: RetrievedMemoryWire[] | null;
  retrieved_files?: string[] | null;
  retrieved_files_count?: number;
  context_usage?: Record<string, unknown> | null;
}

export interface SubmitToolOutputsRequestWire {
  thread_id: string;
  tool_outputs: { tool_call_id: string; output: string }[];
  stream?: boolean;
}

/**
 * SSE event payloads for POST /threads/messages and /threads/tool-outputs
 * when stream=true. Confirmed against a live Backboard response (2026-07-18);
 * several fields diverge from the prose API reference, most notably: only
 * `user_message` carries `thread_id` (not `tool_submit_required` or
 * `run_ended`), and `run_ended.status` is lowercase ("completed").
 */
export type BackboardSseEventWire =
  | { type: "message_received"; phase?: string }
  | {
      type: "user_message";
      thread_id: string;
      message_id?: string;
      content?: string;
      role?: string;
    }
  | { type: "run_started"; run_id: string; message_id?: string; provider?: string; model_name?: string }
  | { type: "run_continuing"; run_id: string; phase?: string }
  | { type: "message_start"; message_id?: string; run_id?: string }
  | { type: "tool_call_ready"; run_id?: string; tool_call: BackboardToolCallWire }
  | { type: "content_streaming"; content?: string; accumulated_content?: string }
  | { type: "reasoning_streaming"; content?: string }
  | { type: "reasoning_ended" }
  | {
      type: "tool_submit_required";
      run_id?: string | null;
      tool_calls: BackboardToolCallWire[];
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      message?: string;
    }
  | {
      type: "run_ended";
      run_id?: string | null;
      status: string;
      content?: string | null;
      final_content?: string | null;
      reasoning?: string | null;
      model_provider?: string | null;
      model_name?: string | null;
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      memory_operation_id?: string | null;
      context_usage?: Record<string, unknown>;
    }
  | { type: string; [key: string]: unknown };

export interface AssistantWire {
  assistant_id: string;
  name: string;
  system_prompt?: string | null;
  tools?: BackboardToolDefinitionWire[] | null;
  created_at: string;
}

export interface CreateAssistantRequestWire {
  name: string;
  system_prompt?: string;
  tools?: BackboardToolDefinitionWire[];
  tok_k?: number;
}

export type DocumentStatusWire = "pending" | "processing" | "indexed" | "error";

export interface DocumentWire {
  document_id: string;
  filename: string;
  status: DocumentStatusWire;
  status_message?: string | null;
  summary?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ThinkingControlsWire {
  supported: boolean;
  allowed_fields: string[];
  defaults_only: boolean;
}

export interface ModelWire {
  name: string;
  provider: string;
  model_type: string;
  context_limit: number;
  max_output_tokens?: number | null;
  supports_tools?: boolean | null;
  supports_thinking?: boolean | null;
  thinking_controls?: ThinkingControlsWire;
  supports_json_output?: boolean | null;
  supports_vision?: boolean | null;
}

export interface ModelsListResponseWire {
  models: ModelWire[];
  total: number;
}

export interface MemoryWire {
  id: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MemoriesListResponseWire {
  memories: MemoryWire[];
  total_count: number;
  page?: number | null;
  page_size?: number | null;
  total_pages?: number | null;
}

export interface MemorySearchResponseWire {
  memories: MemoryWire[];
  total_count: number;
}

export interface MemoryDeleteResponseWire {
  success: boolean;
  message: string;
}
