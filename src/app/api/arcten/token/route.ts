import { verifyToken } from "@arcteninc/core/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user } = body;

    // Get API key from environment variable (format: sk_projectId_randomKey)
    const apiKey = process.env.ARCTEN_API_KEY;

    if (!apiKey) {
      throw new Error("ARCTEN_API_KEY environment variable is not set");
    }

    // Call Arcten API to verify and get client token
    // The verifyToken function will parse the projectId from the apiKey
    const tokenResponse = await verifyToken({
      apiKey,
      user,
    });

    return NextResponse.json(tokenResponse);
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate token",
      },
      { status: 500 }
    );
  }
}
