import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { campaignService } from "./campaign.service";
import {
  dailyRewardUpdateSchema,
  dayIndexParamSchema,
  promotionIdParamSchema,
  promotionUpsertSchema,
  referralSettingsUpdateSchema,
} from "./campaign.schema";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "Authentication required", { code: "AUTHENTICATION_REQUIRED" });
  }
  return req.user;
}

export async function getCampaignConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const config = await campaignService.getConfig();
    void user;
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function getActivePromotions(req: Request, res: Response, next: NextFunction) {
  try {
    const promotions = await campaignService.getActivePromotions();
    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    next(error);
  }
}

export async function updateDailyReward(req: Request<{ dayIndex: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const params = dayIndexParamSchema.safeParse(req.params);
    const body = dailyRewardUpdateSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      throw new AppError(400, "Invalid daily reward update", { code: "INVALID_CAMPAIGN_PAYLOAD" });
    }
    const config = await campaignService.updateDailyReward(user.id, params.data.dayIndex, body.data);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function updateReferralSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const body = referralSettingsUpdateSchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(400, "Invalid referral settings", { code: "INVALID_CAMPAIGN_PAYLOAD" });
    }
    const config = await campaignService.updateReferralSettings(user.id, body.data.rewardCoins);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function upsertPromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const body = promotionUpsertSchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(400, "Invalid promotion", { code: "INVALID_CAMPAIGN_PAYLOAD" });
    }
    const input = { ...body.data };
    const config = await campaignService.upsertPromotion(user.id, input);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function deletePromotion(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const user = requireUser(req);
    const params = promotionIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new AppError(400, "Invalid promotion id", { code: "INVALID_CAMPAIGN_PAYLOAD" });
    }
    const config = await campaignService.deletePromotion(user.id, params.data.id);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}
