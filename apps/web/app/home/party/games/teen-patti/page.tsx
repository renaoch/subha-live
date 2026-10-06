import type { Metadata } from "next";
import { TeenPattiGame } from "@/components/teen-patti/TeenPattiGame";

export const metadata: Metadata = {
  title: "Teen Patti — Solo Practice | Subha",
};

export default function TeenPattiPage() {
  return <TeenPattiGame />;
}