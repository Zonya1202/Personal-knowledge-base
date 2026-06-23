import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { questionSchema, patchSchema } from "@/lib/validation";
import { MAX_LEVEL } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = questionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  const question = await prisma.question.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ question });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  await prisma.question.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}

function nextLevel(current: number, grade: "know" | "unsure" | "dont_know") {
  if (grade === "know") return Math.min(MAX_LEVEL, current + 1);
  if (grade === "unsure") return Math.max(0, current - 1);
  return 0; // dont_know
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  const existing = await prisma.question.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
  }

  const level =
    parsed.data.action === "reset" ? 0 : nextLevel(existing.level, parsed.data.grade);

  const question = await prisma.question.update({
    where: { id },
    data: { level },
  });

  return NextResponse.json({ question });
}
