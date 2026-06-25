import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { questionSchema, patchSchema } from "@/lib/validation";
import { MAX_LEVEL } from "@/lib/types";
import { readJson, isRecordNotFound } from "@/lib/http";

const notFound = () => NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const json = await readJson(request);
  if ("response" in json) return json.response;
  const parsed = questionSchema.safeParse(json.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  try {
    const question = await prisma.question.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ question });
  } catch (error) {
    if (isRecordNotFound(error)) return notFound();
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isRecordNotFound(error)) return notFound();
    throw error;
  }
}

function nextLevel(current: number, grade: "know" | "unsure" | "dont_know") {
  if (grade === "know") return Math.min(MAX_LEVEL, current + 1);
  if (grade === "unsure") return Math.max(0, current - 1);
  return 0; // dont_know
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const json = await readJson(request);
  if ("response" in json) return json.response;
  const parsed = patchSchema.safeParse(json.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  const existing = await prisma.question.findUnique({ where: { id } });

  if (!existing) {
    return notFound();
  }

  const level =
    parsed.data.action === "reset" ? 0 : nextLevel(existing.level, parsed.data.grade);

  const question = await prisma.question.update({
    where: { id },
    data: { level },
  });

  return NextResponse.json({ question });
}
