import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      /** Attached by request-id middleware; propagated to logs + responses. */
      requestId?: string;
    }
  }
}

export {};
