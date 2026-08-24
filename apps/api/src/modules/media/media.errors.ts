import { AppError } from "../../errors/app-error";

export class MediaError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    options?: {
      code?: string;
      details?: unknown;
    },
  ) {
    super(statusCode, message, {
      code: options?.code,
      details: options?.details,
    });

    this.name = "MediaError";
  }
}

export class MediaSessionNotFoundError extends MediaError {
  constructor(sessionId?: string) {
    super(
      404,
      "Media session not found",
      {
        code: "MEDIA_SESSION_NOT_FOUND",
        details: sessionId
          ? { sessionId }
          : undefined,
      },
    );
  }
}

export class MediaSessionExpiredError extends MediaError {
  constructor(sessionId?: string) {
    super(
      409,
      "Media session has expired",
      {
        code: "MEDIA_SESSION_EXPIRED",
        details: sessionId
          ? { sessionId }
          : undefined,
      },
    );
  }
}

export class MediaGenerationMismatchError extends MediaError {
  constructor(
    expectedGeneration: number,
    receivedGeneration: number,
  ) {
    super(
      409,
      "Media generation mismatch",
      {
        code: "MEDIA_GENERATION_MISMATCH",
        details: {
          expectedGeneration,
          receivedGeneration,
        },
      },
    );
  }
}

export class MediaNegotiationError extends MediaError {
  constructor(
    message = "Media negotiation failed",
    details?: unknown,
  ) {
    super(
      409,
      message,
      {
        code: "MEDIA_NEGOTIATION_FAILED",
        details,
      },
    );
  }
}

export class MediaProviderError extends MediaError {
  constructor(
    message = "Media provider operation failed",
    details?: unknown,
  ) {
    super(
      502,
      message,
      {
        code: "MEDIA_PROVIDER_ERROR",
        details,
      },
    );
  }
}

export class MediaCapacityError extends MediaError {
  constructor(
    message = "No media capacity is available",
  ) {
    super(
      409,
      message,
      {
        code: "MEDIA_CAPACITY_EXCEEDED",
      },
    );
  }
}

export class MediaAuthorizationError extends MediaError {
  constructor(
    message = "You are not authorized to perform this media operation",
  ) {
    super(
      403,
      message,
      {
        code: "MEDIA_NOT_AUTHORIZED",
      },
    );
  }
}

export class MediaRateLimitError extends MediaError {
  constructor(
    message = "Too many media requests",
  ) {
    super(
      429,
      message,
      {
        code: "MEDIA_RATE_LIMITED",
      },
    );
  }
}

export class MediaStateConflictError extends MediaError {
  constructor(
    message = "Media state conflict",
    details?: unknown,
  ) {
    super(
      409,
      message,
      {
        code: "MEDIA_STATE_CONFLICT",
        details,
      },
    );
  }
}

export class MediaIdempotencyError extends MediaError {
  constructor(
    message = "Invalid or conflicting idempotency request",
    details?: unknown,
  ) {
    super(
      409,
      message,
      {
        code: "MEDIA_IDEMPOTENCY_CONFLICT",
        details,
      },
    );
  }
}