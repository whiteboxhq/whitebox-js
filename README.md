# @whiteboxhq/sdk

TypeScript/JavaScript SDK for the [WhiteBox](https://whiteboxhq.ai) AI Decision Observability API.

Zero dependencies -- uses native `fetch`.

## Install

```bash
npm install @whiteboxhq/sdk
```

## Quick Start

```typescript
import { Whitebox } from '@whiteboxhq/sdk';

const wb = new Whitebox({ apiKey: 'your-api-key' });

const decision = await wb.decide({
  input: 'Is this transaction fraudulent?',
  options: ['legitimate', 'fraudulent'],
  sync: true,
});

console.log(decision.value);      // "legitimate"
console.log(decision.confidence); // 0.95
console.log(decision.verdict);    // "ship"
```

## Fast Mode

Returns a single-run synchronous decision for low-latency use cases.

```typescript
const decision = await wb.decideFast({
  input: 'Classify this support ticket',
  options: ['billing', 'technical', 'general'],
});
```

## Bulk Decisions

Submit many decisions at once and retrieve results later.

```typescript
const batch = await wb.decideBulk({
  items: [
    { input: 'Review text 1', options: ['positive', 'negative'] },
    { input: 'Review text 2', options: ['positive', 'negative'] },
  ],
  webhook_url: 'https://example.com/webhook',
});

console.log(batch.id);       // batch ID
console.log(batch.progress); // 0

// Poll for results
const results = await wb.getBatchResults(batch.id);
```

## Retrieving Decisions

```typescript
// Single decision by ID
const decision = await wb.getDecision('dec_abc123');

// Paginated list
const decisions = await wb.listDecisions(1, 25);
```

## Handling Reviews

When confidence is low, decisions are escalated for human review.

```typescript
const reviews = await wb.listReviews();

for (const review of reviews) {
  console.log(review.input, review.model_votes);
}

// Resolve a review
await wb.resolveReview(review.id, 'legitimate');
```

## Error Handling

```typescript
import { WhiteboxError, AuthenticationError, RateLimitError } from '@whiteboxhq/sdk';

try {
  await wb.decide({ input: '...', options: ['a', 'b'] });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Retry after ${err.retryAfter} seconds`);
  } else if (err instanceof AuthenticationError) {
    console.log('Check your API key');
  } else if (err instanceof WhiteboxError) {
    console.log(err.statusCode, err.message);
  }
}
```

## Configuration

```typescript
const wb = new Whitebox({
  apiKey: 'your-api-key',
  baseUrl: 'https://whiteboxhq.ai/api/v1', // default
  timeout: 30000,                            // ms, default 30s
});
```

## License

MIT
