import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { importSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Файл не является корректным JSON" }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный формат бэкапа" },
      { status: 400 }
    );
  }

  const { questions } = parsed.data;

  await prisma.$transaction(
    questions.map((q) =>
      prisma.question.upsert({
        where: { id: q.id },
        update: {
          profession: q.profession,
          topic: q.topic,
          subtopic: q.subtopic,
          question: q.question,
          answer: q.answer,
          level: q.level ?? 0,
        },
        create: {
          id: q.id,
          profession: q.profession,
          topic: q.topic,
          subtopic: q.subtopic,
          question: q.question,
          answer: q.answer,
          level: q.level ?? 0,
        },
      })
    )
  );

  return NextResponse.json({ imported: questions.length });
}
