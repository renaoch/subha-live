// File: apps/web/lib/api/client.ts

import { createClient } from "@/lib/supabase/client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL",
  );
}

/* ==========================================================================
 * FETCH
 * ========================================================================== */

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase =
    createClient();

  const {
    data: { session },
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const headers =
    new Headers(options.headers);

  if (
    !headers.has(
      "Content-Type",
    ) &&
    options.body
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (session?.access_token) {
    headers.set(
      "Authorization",
      `Bearer ${session.access_token}`,
    );
  }

  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      },
    );

  if (!response.ok) {
    let message =
      `API request failed: ${response.status}`;

    try {
      const data =
        await response.json();

      /*
       * Handle:
       *
       * {
       *   message: "..."
       * }
       *
       * OR:
       *
       * {
       *   error: "..."
       * }
       *
       * OR:
       *
       * {
       *   error: {
       *     code: "...",
       *     message: "..."
       *   }
       * }
       */

      if (
        typeof data?.message ===
        "string"
      ) {
        message =
          data.message;
      } else if (
        typeof data?.error ===
        "string"
      ) {
        message =
          data.error;
      } else if (
        data?.error &&
        typeof data.error ===
          "object"
      ) {
        if (
          typeof data.error
            .message ===
          "string"
        ) {
          message =
            data.error.message;
        } else if (
          typeof data.error
            .code ===
          "string"
        ) {
          message =
            data.error.code;
        } else {
          message =
            JSON.stringify(
              data.error,
            );
        }
      } else if (
        data &&
        typeof data ===
          "object"
      ) {
        message =
          JSON.stringify(
            data,
          );
      }
    } catch {
      // Response was not JSON.
    }

    throw new Error(
      message,
    );
  }

  if (
    response.status ===
    204
  ) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/* ==========================================================================
 * API CLIENT
 * ========================================================================== */

export const api = {
  get<T = unknown>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(
      path,
      {
        ...options,
        method: "GET",
      },
    );
  },

  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(
      path,
      {
        ...options,
        method: "POST",

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body,
              ),
      },
    );
  },

  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(
      path,
      {
        ...options,
        method: "PATCH",

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body,
              ),
      },
    );
  },

  put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(
      path,
      {
        ...options,
        method: "PUT",

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body,
              ),
      },
    );
  },

  delete<T = unknown>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    return apiFetch<T>(
      path,
      {
        ...options,
        method: "DELETE",
      },
    );
  },
};