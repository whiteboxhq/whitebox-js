import type {
  WhiteboxConfig,
  DecideOptions,
  BulkDecideOptions,
  Decision,
  Batch,
  Review,
} from './types';
import {
  WhiteboxError,
  AuthenticationError,
  RateLimitError,
  InsufficientCreditsError,
} from './errors';

const DEFAULT_BASE_URL = 'https://whiteboxhq.ai/api/v1';
const DEFAULT_TIMEOUT = 30_000;

export class Whitebox {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: WhiteboxConfig) {
    if (!config.apiKey) {
      throw new WhiteboxError('API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Submit a single decision request.
   */
  async decide(options: DecideOptions): Promise<Decision> {
    const body: Record<string, unknown> = {
      input: options.input,
      options: options.options,
      prompt: options.prompt,
      runs: options.runs,
      threshold: options.threshold,
      sync: options.sync,
      mode: options.mode,
    };
    if (options.models) body.models = options.models;
    return this.request<Decision>('POST', '/decide', body);
  }

  /**
   * Submit a fast-mode decision (single run, synchronous).
   */
  async decideFast(
    options: Omit<DecideOptions, 'mode' | 'runs' | 'sync'>
  ): Promise<Decision> {
    return this.decide({ ...options, mode: 'fast', runs: 1, sync: true });
  }

  /**
   * Submit a bulk decision request.
   */
  async decideBulk(options: BulkDecideOptions): Promise<Batch> {
    return this.request<Batch>('POST', '/decide/bulk', {
      items: options.items,
      prompt: options.prompt,
      options: options.options,
      runs: options.runs,
      threshold: options.threshold,
      webhook_url: options.webhook_url,
    });
  }

  /**
   * Get a single decision by ID.
   */
  async getDecision(id: string): Promise<Decision> {
    return this.request<Decision>('GET', `/decisions/${encodeURIComponent(id)}`);
  }

  /**
   * List decisions with optional pagination.
   */
  async listDecisions(page?: number, perPage?: number): Promise<Decision[]> {
    const params = new URLSearchParams();
    if (page != null) params.set('page', String(page));
    if (perPage != null) params.set('per_page', String(perPage));
    const query = params.toString();
    const path = query ? `/decisions?${query}` : '/decisions';
    const data = await this.request<{ decisions: Decision[]; total: number; page: number }>('GET', path);
    return (data as any).decisions ?? data;
  }

  /**
   * Get batch status by ID.
   */
  async getBatch(id: string): Promise<Batch> {
    return this.request<Batch>('GET', `/batches/${encodeURIComponent(id)}`);
  }

  /**
   * Get batch results by ID.
   */
  async getBatchResults(
    id: string
  ): Promise<{ id: string; status: string; results: Decision[] }> {
    return this.request<{ id: string; status: string; results: Decision[] }>(
      'GET',
      `/batches/${encodeURIComponent(id)}/results`
    );
  }

  /**
   * List pending reviews.
   */
  async listReviews(): Promise<Review[]> {
    return this.request<Review[]>('GET', '/reviews');
  }

  /**
   * Resolve a review by ID.
   */
  async resolveReview(id: number, answer: string): Promise<Review> {
    return this.request<Review>('PATCH', `/reviews/${encodeURIComponent(String(id))}`, {
      answer,
    });
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };

    const init: RequestInit & { signal?: AbortSignal } = {
      method,
      headers,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    init.signal = controller.signal;

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new WhiteboxError(`Request timed out after ${this.timeout}ms`);
      }
      throw new WhiteboxError(`Network error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    let data: any;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        (typeof data === 'object' && data?.error) ||
        (typeof data === 'string' && data) ||
        response.statusText;

      switch (response.status) {
        case 401:
          throw new AuthenticationError(message, data);
        case 402:
          throw new InsufficientCreditsError(message, data);
        case 429: {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            message,
            retryAfter ? Number(retryAfter) : undefined,
            data
          );
        }
        default:
          throw new WhiteboxError(message, response.status, data);
      }
    }

    return data as T;
  }
}
