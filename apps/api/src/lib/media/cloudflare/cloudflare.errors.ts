export class CloudflareRealtimeError extends Error {
  readonly statusCode: number;

  readonly retryable: boolean;

  readonly responseBody?: unknown;

  constructor(
    message: string,
    options: {
      statusCode: number;
      retryable?: boolean;
      responseBody?: unknown;
    },
  ) {
    super(message);

    this.name =
      "CloudflareRealtimeError";

    this.statusCode =
      options.statusCode;

    this.retryable =
      options.retryable ?? false;

    this.responseBody =
      options.responseBody;
  }
}

export function isRetryableCloudflareStatus(
  statusCode: number,
): boolean {
  if (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 429
  ) {
    return true;
  }

  return statusCode >= 500;
}