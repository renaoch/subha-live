import { z } from "zod";

export const storeItemParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Store item ID is required")
    .max(100, "Store item ID is too long"),
});

export type StoreItemParams = z.infer<
  typeof storeItemParamsSchema
>;