export interface Run {
  model: string;
  answer: string | null;
  logprob: number | null;
  latency_ms: number;
}

export interface Decision {
  id: string;
  status: 'processing' | 'complete';
  value: string | null;
  confidence: number | null;
  verdict: 'ship' | 'warn' | 'escalate';
  escalated: boolean;
  runs: Run[];
  latency_ms: number;
  cost_usd: number;
  created_at: string;
  mode?: string;
}

export interface Batch {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  total: number;
  completed: number;
  failed: number;
  progress: number;
  webhook_url: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Review {
  id: number;
  decision_id: string;
  status: string;
  input: string;
  options: string[];
  model_votes: Record<string, number>;
  confidence: number;
  sla_deadline: string | null;
  created_at: string;
}

export interface DecideOptions {
  input: string;
  options: string[];
  prompt?: string;
  runs?: number;
  threshold?: number;
  sync?: boolean;
  mode?: 'standard' | 'fast';
}

export interface BulkDecideOptions {
  items: Array<{ input: string; options?: string[]; prompt?: string }>;
  prompt?: string;
  options?: string[];
  runs?: number;
  threshold?: number;
  webhook_url?: string;
}

export interface WhiteboxConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}
