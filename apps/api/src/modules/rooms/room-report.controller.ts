
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { supabase } from "../../lib/supabase";

const REASONS = ["inappropriate", "harassment", "spam", "underage", "illegal", "other"];

export async function reportRoom(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
    }
    const roomId = String(req.params.id);
    const reason = String(req.body?.reason ?? "");
    const details = typeof req.body?.details === "string" ? req.body.details.slice(0, 500) : null;
    if (!REASONS.includes(reason)) {
      throw new AppError(400, "Invalid report reason", { code: "INVALID_REASON" });
    }

    // room_reports is new; regenerate database.types.ts to drop this cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("room_reports").insert({
      room_id: roomId,
      reporter_id: req.user.id,
      reason,
      details,
    });
    if (error) throw new AppError(500, "Could not submit report", { code: "REPORT_FAILED" });

    res.status(201).json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
}