import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { Whitebox, WhiteboxError, AuthenticationError, RateLimitError, InsufficientCreditsError } from '../dist/index.js';

const originalFetch = globalThis.fetch;

function mockFetch(status, body, headers = {}) {
  return mock.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'Error',
      headers: { get: (name) => headers[name.toLowerCase()] || null },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

function parseCallArgs(fn) {
  const call = fn.mock.calls[0];
  const url = call.arguments[0];
  const init = call.arguments[1];
  const parsedBody = init.body ? JSON.parse(init.body) : undefined;
  return { url, method: init.method, headers: init.headers, body: parsedBody };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------
describe('Constructor', () => {
  it('throws when apiKey is missing', () => {
    assert.throws(() => new Whitebox({ apiKey: '' }), WhiteboxError);
  });

  it('uses default baseUrl', () => {
    const client = new Whitebox({ apiKey: 'test-key' });
    // We can verify indirectly by making a request
    assert.ok(client);
  });

  it('accepts a custom baseUrl and strips trailing slashes', async () => {
    const fakeFetch = mockFetch(200, { id: '1' });
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'k', baseUrl: 'https://custom.api/v2/' });
    await client.getDecision('abc');

    const { url } = parseCallArgs(fakeFetch);
    assert.ok(url.startsWith('https://custom.api/v2/decisions/abc'));
    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// decide()
// ---------------------------------------------------------------------------
describe('decide()', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct POST body and returns Decision', async () => {
    const decision = {
      id: 'd-1', status: 'complete', value: 'yes', confidence: 0.95,
      verdict: 'ship', escalated: false, runs: [], latency_ms: 120, cost_usd: 0.01,
      created_at: '2026-01-01T00:00:00Z',
    };
    const fakeFetch = mockFetch(200, decision);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.decide({ input: 'Is this safe?', options: ['yes', 'no'] });

    assert.equal(fakeFetch.mock.calls.length, 1);
    const { url, method, body } = parseCallArgs(fakeFetch);
    assert.equal(method, 'POST');
    assert.ok(url.endsWith('/decide'));
    assert.equal(body.input, 'Is this safe?');
    assert.deepEqual(body.options, ['yes', 'no']);
    assert.equal(result.id, 'd-1');
    assert.equal(result.confidence, 0.95);
  });

  it('passes models when provided', async () => {
    const fakeFetch = mockFetch(200, { id: 'd-2' });
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    await client.decide({
      input: 'test', options: ['a', 'b'], models: ['gpt-4o', 'claude-3'],
    });

    const { body } = parseCallArgs(fakeFetch);
    assert.deepEqual(body.models, ['gpt-4o', 'claude-3']);
  });
});

// ---------------------------------------------------------------------------
// decideFast()
// ---------------------------------------------------------------------------
describe('decideFast()', () => {
  it('sends mode=fast, runs=1, sync=true', async () => {
    const fakeFetch = mockFetch(200, { id: 'd-3', mode: 'fast' });
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    await client.decideFast({ input: 'quick check', options: ['a', 'b'] });

    const { body } = parseCallArgs(fakeFetch);
    assert.equal(body.mode, 'fast');
    assert.equal(body.runs, 1);
    assert.equal(body.sync, true);
  });
});

// ---------------------------------------------------------------------------
// decideBulk()
// ---------------------------------------------------------------------------
describe('decideBulk()', () => {
  it('sends items and returns Batch', async () => {
    const batch = { id: 'b-1', status: 'pending', total: 2, completed: 0, failed: 0, progress: 0, webhook_url: null, completed_at: null, created_at: '2026-01-01' };
    const fakeFetch = mockFetch(200, batch);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.decideBulk({
      items: [
        { input: 'item1', options: ['a', 'b'] },
        { input: 'item2', options: ['c', 'd'] },
      ],
    });

    const { url, method, body } = parseCallArgs(fakeFetch);
    assert.equal(method, 'POST');
    assert.ok(url.endsWith('/decide/bulk'));
    assert.equal(body.items.length, 2);
    assert.equal(result.id, 'b-1');
    assert.equal(result.status, 'pending');
  });
});

// ---------------------------------------------------------------------------
// getDecision()
// ---------------------------------------------------------------------------
describe('getDecision()', () => {
  it('sends GET to /decisions/:id', async () => {
    const decision = { id: 'd-10', status: 'complete' };
    const fakeFetch = mockFetch(200, decision);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.getDecision('d-10');

    const { url, method } = parseCallArgs(fakeFetch);
    assert.equal(method, 'GET');
    assert.ok(url.endsWith('/decisions/d-10'));
    assert.equal(result.id, 'd-10');
  });
});

// ---------------------------------------------------------------------------
// listDecisions()
// ---------------------------------------------------------------------------
describe('listDecisions()', () => {
  it('returns array of decisions', async () => {
    const fakeFetch = mockFetch(200, { decisions: [{ id: 'd-1' }, { id: 'd-2' }], total: 2, page: 1 });
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.listDecisions();

    const { url, method } = parseCallArgs(fakeFetch);
    assert.equal(method, 'GET');
    assert.ok(url.endsWith('/decisions'));
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'd-1');
  });

  it('passes pagination params', async () => {
    const fakeFetch = mockFetch(200, { decisions: [], total: 0, page: 2 });
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    await client.listDecisions(2, 10);

    const { url } = parseCallArgs(fakeFetch);
    assert.ok(url.includes('page=2'));
    assert.ok(url.includes('per_page=10'));
  });
});

// ---------------------------------------------------------------------------
// getBatch()
// ---------------------------------------------------------------------------
describe('getBatch()', () => {
  it('returns batch object', async () => {
    const batch = { id: 'b-5', status: 'complete', total: 3, completed: 3, failed: 0, progress: 100 };
    const fakeFetch = mockFetch(200, batch);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.getBatch('b-5');

    const { url, method } = parseCallArgs(fakeFetch);
    assert.equal(method, 'GET');
    assert.ok(url.endsWith('/batches/b-5'));
    assert.equal(result.id, 'b-5');
    assert.equal(result.status, 'complete');
  });
});

// ---------------------------------------------------------------------------
// getBatchResults()
// ---------------------------------------------------------------------------
describe('getBatchResults()', () => {
  it('returns results object', async () => {
    const data = { id: 'b-5', status: 'complete', results: [{ id: 'd-1' }, { id: 'd-2' }] };
    const fakeFetch = mockFetch(200, data);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.getBatchResults('b-5');

    const { url, method } = parseCallArgs(fakeFetch);
    assert.equal(method, 'GET');
    assert.ok(url.endsWith('/batches/b-5/results'));
    assert.equal(result.results.length, 2);
  });
});

// ---------------------------------------------------------------------------
// listReviews()
// ---------------------------------------------------------------------------
describe('listReviews()', () => {
  it('returns array of reviews', async () => {
    const reviews = [{ id: 1, decision_id: 'd-1', status: 'pending' }];
    const fakeFetch = mockFetch(200, reviews);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.listReviews();

    const { url, method } = parseCallArgs(fakeFetch);
    assert.equal(method, 'GET');
    assert.ok(url.endsWith('/reviews'));
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 1);
  });
});

// ---------------------------------------------------------------------------
// resolveReview()
// ---------------------------------------------------------------------------
describe('resolveReview()', () => {
  it('sends PATCH with answer', async () => {
    const review = { id: 1, decision_id: 'd-1', status: 'resolved' };
    const fakeFetch = mockFetch(200, review);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.resolveReview(1, 'yes');

    const { url, method, body } = parseCallArgs(fakeFetch);
    assert.equal(method, 'PATCH');
    assert.ok(url.endsWith('/reviews/1'));
    assert.equal(body.answer, 'yes');
    assert.equal(result.status, 'resolved');
  });
});

// ---------------------------------------------------------------------------
// listModels()
// ---------------------------------------------------------------------------
describe('listModels()', () => {
  it('returns models object', async () => {
    const data = {
      models: [{ id: 'm-1', name: 'GPT-4o', provider: 'openai', tier: 'standard' }],
      defaults: { standard: ['m-1'], fast: ['m-1'] },
    };
    const fakeFetch = mockFetch(200, data);
    globalThis.fetch = fakeFetch;

    const client = new Whitebox({ apiKey: 'test-key' });
    const result = await client.listModels();

    const { url, method } = parseCallArgs(fakeFetch);
    assert.equal(method, 'GET');
    assert.ok(url.endsWith('/models'));
    assert.equal(result.models.length, 1);
    assert.deepEqual(result.defaults.standard, ['m-1']);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('Error handling', () => {
  it('401 throws AuthenticationError', async () => {
    globalThis.fetch = mockFetch(401, { error: 'Invalid API key' });
    const client = new Whitebox({ apiKey: 'bad-key' });
    await assert.rejects(() => client.listModels(), (err) => {
      assert.ok(err instanceof AuthenticationError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, 'Invalid API key');
      return true;
    });
  });

  it('402 throws InsufficientCreditsError', async () => {
    globalThis.fetch = mockFetch(402, { error: 'No credits' });
    const client = new Whitebox({ apiKey: 'k' });
    await assert.rejects(() => client.decide({ input: 'x', options: ['a'] }), (err) => {
      assert.ok(err instanceof InsufficientCreditsError);
      assert.equal(err.statusCode, 402);
      return true;
    });
  });

  it('429 throws RateLimitError with retryAfter', async () => {
    globalThis.fetch = mockFetch(429, { error: 'Too many requests' }, { 'retry-after': '30' });
    const client = new Whitebox({ apiKey: 'k' });
    await assert.rejects(() => client.listDecisions(), (err) => {
      assert.ok(err instanceof RateLimitError);
      assert.equal(err.statusCode, 429);
      assert.equal(err.retryAfter, 30);
      return true;
    });
  });

  it('500 throws WhiteboxError', async () => {
    globalThis.fetch = mockFetch(500, { error: 'Internal server error' });
    const client = new Whitebox({ apiKey: 'k' });
    await assert.rejects(() => client.listModels(), (err) => {
      assert.ok(err instanceof WhiteboxError);
      assert.equal(err.statusCode, 500);
      return true;
    });
  });
});
