import { Request, Response, NextFunction } from "express";

import { followUser, unfollowUser, getFollowers, getFollowing, getFollowStatus, blockUser, unblockUser, getBlockStatus, muteUser, unmuteUser, getMuteStatus,} from "./social.service";
import { paginationSchema } from "./social.schema";
import { AppError } from "../../errors/app-error";

// follow a user
export async function followUserController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const follow = await followUser(
      req.user.id,
      id
    );

    return res.status(201).json({
      status: "ok",
      follow,
    });
  } catch (error) {
    next(error);
  }
}

// unfollow a user
export async function unfollowUserController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const unfollow = await unfollowUser(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      unfollow,
    });
  } catch (error) {
    next(error);
  }
}

// get followers of a user
// get followers of a user
export async function getFollowersController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const result = paginationSchema.safeParse(req.query);

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid pagination parameters",
        {
          code: "INVALID_PAGINATION",
          details: result.error.flatten().fieldErrors,
        }
      );
    }

    const { limit, cursor } = result.data;

    const followers = await getFollowers(
      id,
      limit,
      cursor
    );

    return res.status(200).json({
      status: "ok",
      ...followers,
    });
  } catch (error) {
    next(error);
  }
}

// get users that a user is following
// get users that a user is following
export async function getFollowingController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const result = paginationSchema.safeParse(req.query);

    if (!result.success) {
      throw new AppError(
        400,
        "Invalid pagination parameters",
        {
          code: "INVALID_PAGINATION",
          details: result.error.flatten().fieldErrors,
        }
      );
    }

    const { limit, cursor } = result.data;

    const following = await getFollowing(
      id,
      limit,
      cursor
    );

    return res.status(200).json({
      status: "ok",
      ...following,
    });
  } catch (error) {
    next(error);
  }
}

// get follow status between authenticated user and target user
export async function getFollowStatusController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const result = await getFollowStatus(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

// block a user
export async function blockUserController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const block = await blockUser(
      req.user.id,
      id
    );

    return res.status(201).json({
      status: "ok",
      block,
    });
  } catch (error) {
    next(error);
  }
}

// unblock a user
export async function unblockUserController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const unblock = await unblockUser(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      unblock,
    });
  } catch (error) {
    next(error);
  }
}

// get block status between authenticated user and target user
export async function getBlockStatusController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const result = await getBlockStatus(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

// mute a user
export async function muteUserController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const mute = await muteUser(
      req.user.id,
      id
    );

    return res.status(201).json({
      status: "ok",
      mute,
    });
  } catch (error) {
    next(error);
  }
}

// unmute a user
export async function unmuteUserController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const unmute = await unmuteUser(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      unmute,
    });
  } catch (error) {
    next(error);
  }
}

// get mute status between authenticated user and target user
export async function getMuteStatusController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new AppError(
        401,
        "Authentication required",
        {
          code: "AUTHENTICATION_REQUIRED",
        }
      );
    }

    const { id } = req.params;

    const result = await getMuteStatus(
      req.user.id,
      id
    );

    return res.status(200).json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}