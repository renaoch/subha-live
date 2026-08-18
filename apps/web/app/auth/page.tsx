import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = {
  title: "Sign in — Subha",
};

export default function AuthPage() {
  return <AuthScreen />;
}
