import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// Безопасно читает JSON-тело запроса.
// Возвращает { data } при успехе или { response } с 400, если тело — битый JSON.
export async function readJson<T = unknown>(
  request: Request
): Promise<{ data: T } | { response: NextResponse }> {
  try {
    return { data: (await request.json()) as T };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Тело запроса — некорректный JSON" },
        { status: 400 }
      ),
    };
  }
}

// true, если Prisma не нашла запись (код P2025) — повод отдать 404 вместо 500.
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  );
}
