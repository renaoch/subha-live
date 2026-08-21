import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    // email: "chetriprem.work@gmail.com",
    // password: "renao123",
        email: "chetri.prem999@gmail.com",
    password: "chetri.prem999@gmail.com",
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log("Access token:");
  console.log(data.session?.access_token);
}

main();