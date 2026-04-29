export class WhiteboxError extends Error {
  statusCode?: number;
  response?: any;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'WhiteboxError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class AuthenticationError extends WhiteboxError {
  constructor(message: string = 'Invalid or missing API key', response?: any) {
    super(message, 401, response);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends WhiteboxError {
  retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, response?: any) {
    super(message, 429, response);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class InsufficientCreditsError extends WhiteboxError {
  constructor(message: string = 'Insufficient credits', response?: any) {
    super(message, 402, response);
    this.name = 'InsufficientCreditsError';
  }
}
