import { NextResponse } from "next/server";

import { ASSISTANT_ROSTER, type AssistantRoleKey } from "@/lib/backboard/assistants";

export function isAssistantRoleKey(value: string): value is AssistantRoleKey {
  return value in ASSISTANT_ROSTER;
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
