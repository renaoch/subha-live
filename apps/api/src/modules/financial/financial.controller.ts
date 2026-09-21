import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../errors/app-error";
import {
  sendGiftSchema,
  withdrawalRequestSchema,
  processWithdrawalSchema,
  paginationSchema,
  hostContributorsParamsSchema,
  hostContributorsQuerySchema,
} from "./financial.schema";
import {
  getActiveGiftCatalog,
  sendGiftTransaction,
  requestWithdrawalTransaction,
  processWithdrawalTransaction,
  getLedgerHistory,
  getHostEarnings,
  getUserWithdrawals,
  listPendingWithdrawals,
  assertIsPlatformAdmin,
  getHostContributors,
} from "./financial.service";
import { publishGiftToRoomChat } from "./financial-chat";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}

export async function getGiftCatalogController(req: Request, res: Response, next: NextFunction) {
  try {
    const gifts = await getActiveGiftCatalog();
    res.status(200).json({ status: "ok", gifts });
  } catch (error) {
    next(error);
  }
}

export async function sendGiftController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = sendGiftSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid gift payload", {
        code: "INVALID_GIFT_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await sendGiftTransaction({
      senderId: user.id,
      recipientId: parsed.data.recipientId,
      giftId: parsed.data.giftId,
      roomId: parsed.data.roomId,
      clientRequestId: parsed.data.clientRequestId,
    });

    // Fire-and-forget: post the gift into the room's live chat feed. Only
    // for genuinely new sends (not idempotent retries replaying an already-
    // processed request) and only when it was actually sent in a room.
    if (!result.alreadyProcessed && parsed.data.roomId) {
      void publishGiftToRoomChat({
        roomId: parsed.data.roomId,
        senderId: user.id,
        giftId: parsed.data.giftId,
        giftTransactionId: result.giftTransactionId,
      });
    }

    res.status(result.alreadyProcessed ? 200 : 201).json({ status: "ok", gift: result });
  } catch (error) {
    next(error);
  }
}

export async function getLedgerController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = paginationSchema.parse(req.query);
    const entries = await getLedgerHistory(user.id, query.limit, query.offset);
    res.status(200).json({ status: "ok", entries });
  } catch (error) {
    next(error);
  }
}

export async function getMyEarningsController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const query = paginationSchema.parse(req.query);
    const earnings = await getHostEarnings(user.id, query.limit, query.offset);
    res.status(200).json({ status: "ok", earnings });
  } catch (error) {
    next(error);
  }
}

export async function requestWithdrawalController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const parsed = withdrawalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid withdrawal payload", {
        code: "INVALID_WITHDRAWAL_PAYLOAD",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await requestWithdrawalTransaction({
      userId: user.id,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      bankAccount: parsed.data.bankAccount,
      upiId: parsed.data.upiId,
      note: parsed.data.note,
      clientRequestId: parsed.data.clientRequestId,
    });

    res.status(result.alreadyProcessed ? 200 : 201).json({ status: "ok", withdrawal: result });
  } catch (error) {
    next(error);
  }
}

export async function getMyWithdrawalsController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const withdrawals = await getUserWithdrawals(user.id);
    res.status(200).json({ status: "ok", withdrawals });
  } catch (error) {
    next(error);
  }
}

export async function listPendingWithdrawalsController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);
    const withdrawals = await listPendingWithdrawals();
    res.status(200).json({ status: "ok", withdrawals });
  } catch (error) {
    next(error);
  }
}

export async function processWithdrawalController(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    await assertIsPlatformAdmin(user.id);

    const parsed = processWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid decision payload", {
        code: "INVALID_WITHDRAWAL_DECISION",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await processWithdrawalTransaction({
      adminId: user.id,
      withdrawalId: req.params.id,
      action: parsed.data.action,
      adminNote: parsed.data.adminNote,
    });

    res.status(200).json({ status: "ok", withdrawal: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Leaderboard of who has gifted a host the most (daily / weekly / monthly /
 * overall). Readable by any signed-in user — it powers the live-room
 * "Top contributors" modal, which hosts and viewers both see.
 */
export async function getHostContributorsController(
  req: Request<{ hostId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    requireUser(req);
    const params = hostContributorsParamsSchema.safeParse(req.params);
    const query = hostContributorsQuerySchema.safeParse(req.query);
    if (!params.success || !query.success) {
      throw new AppError(400, "Invalid contributors request", {
        code: "INVALID_CONTRIBUTORS_REQUEST",
      });
    }

    const contributors = await getHostContributors(
      params.data.hostId,
      query.data.period,
      query.data.limit,
    );
    res.status(200).json({
      status: "ok",
      hostId: params.data.hostId,
      period: query.data.period,
      contributors,
    });
  } catch (error) {
    next(error);
  }
}