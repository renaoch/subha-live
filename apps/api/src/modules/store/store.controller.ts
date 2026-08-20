import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../../errors/app-error";

import {
  getStore,
  getMyInventory,
  purchaseStoreItem,
  equipInventoryItem,
} from "./store.service";

import {
  storeItemParamsSchema,
} from "./store.schema";

export async function getStoreController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result =
      await getStore();

    return res.status(200).json({
      status: "ok",
      items: result.items,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyInventoryController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code:
            "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const result =
      await getMyInventory(
        req.user.id,
      );

    return res.status(200).json({
      status: "ok",
      items: result.items,
    });
  } catch (error) {
    next(error);
  }
}

export async function purchaseStoreItemController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code:
            "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const parsed =
      storeItemParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid store item ID",
        {
          code:
            "INVALID_STORE_ITEM_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const result =
      await purchaseStoreItem(
        req.user.id,
        parsed.data.id,
      );

    return res.status(200).json({
      status: "ok",
      purchase: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function equipInventoryItemController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code:
            "AUTHENTICATION_REQUIRED",
        },
      );
    }

    const parsed =
      storeItemParamsSchema.safeParse(
        req.params,
      );

    if (!parsed.success) {
      throw new AppError(
        400,
        "Invalid inventory item ID",
        {
          code:
            "INVALID_INVENTORY_ITEM_ID",
          details:
            parsed.error.flatten()
              .fieldErrors,
        },
      );
    }

    const result =
      await equipInventoryItem(
        req.user.id,
        parsed.data.id,
      );

    return res.status(200).json({
      status: "ok",
      item: result,
    });
  } catch (error) {
    next(error);
  }
}