import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { questionSchema, reviewSchema } from "@/lib/validation";

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

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);

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

  const knowIncrement = parsed.data.grade === "know" ? 1 : 0;
  const unsureIncrement = parsed.data.grade === "unsure" ? 1 : 0;
  const dontKnowIncrement = parsed.data.grade === "dont_know" ? 1 : 0;

  const question = await prisma.question.update({
    where: { id },
    data: {
      lastReviewedAt: new Date(),
      knowCount: { increment: knowIncrement },
      unsureCount: { increment: unsureIncrement },
      dontKnowCount: { increment: dontKnowIncrement },
    },
  });

  return NextResponse.json({ question });
}
