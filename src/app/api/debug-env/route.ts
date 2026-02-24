// Debug endpoint to check environment variables
import { NextResponse } from "next/server";

export async function GET() {
  const envVars = {
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? "SET (length: " + process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length + ")" : "NOT SET",
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || "NOT SET",
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || "NOT SET",
    GEMINI_MODEL: process.env.GEMINI_MODEL || "NOT SET",
    CRON_SECRET: process.env.CRON_SECRET ? "SET (length: " + process.env.CRON_SECRET.length + ")" : "NOT SET",
    LINKEDIN_ACCESS_TOKEN: process.env.LINKEDIN_ACCESS_TOKEN ? "SET (length: " + process.env.LINKEDIN_ACCESS_TOKEN.length + ")" : "NOT SET",
    LINKEDIN_USER_URN: process.env.LINKEDIN_USER_URN || "NOT SET",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
  };

  // Try to parse Google key if set
  let keyParsable = false;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      keyParsable = true;
    } catch (e) {
      keyParsable = false;
    }
  }

  return NextResponse.json({
    envVars,
    googleKeyParsable: keyParsable,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
