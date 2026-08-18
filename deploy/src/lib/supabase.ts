import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
 
// Validation
console.log("Supabase URL:", supabaseUrl ? "Loaded" : "Missing");
console.log(
  "Supabase service role key:",
  supabaseServiceRoleKey ? "Loaded" : "Missing"
);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
  );
}

// Client Creation
export const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        },
    }
);
