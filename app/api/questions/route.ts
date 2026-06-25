import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { questionSchema } from "@/lib/validation";
import { readJson } from "@/lib/http";

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
  const json = await readJson(request);
  if ("response" in json) return json.response;
  const parsed = questionSchema.safeParse(json.data);

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
