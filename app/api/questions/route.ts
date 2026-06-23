import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { questionSchema } from "@/lib/validation";

export async function GET() {
  const questions = await prisma.question.findMany({
    orderBy: [{ profession: "asc" }, { topic: "asc" }, { updatedAt: "desc" }],
  });

  const professions = Array.from(new Set(questions.map((item) => item.profession))).sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  return NextResponse.json({
    questions,
    professions,
    totalCount: questions.length,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = questionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  const question = await prisma.question.create({
    data: parsed.data,
  });

  return NextResponse.json({ question }, { status: 201 });
}
