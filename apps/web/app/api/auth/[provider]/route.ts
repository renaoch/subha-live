import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const { provider } = await params;

  if (provider !== "google" && provider !== "facebook") {
    return NextResponse.json(
      {
        error: "Unsupported authentication provider",
      },
      {
        status: 400,
      },
    );
  }

  // TODO:
  // Replace this with your actual OAuth implementation.
  //
  // For example:
  // if (provider === "google") {
  //   ...
  // }

  return NextResponse.json({
    success: true,
    provider,
  });
}