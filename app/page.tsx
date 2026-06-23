import { prisma } from "@/lib/prisma";
import KnowledgeBase from "./knowledge-base";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const questions = await prisma.question.findMany({
    orderBy: [{ profession: "asc" }, { topic: "asc" }, { updatedAt: "desc" }],
  });

  const professions = Array.from(new Set(questions.map((item) => item.profession))).sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  // Prisma отдаёт DateTime как Date — сериализуем в строки для клиентского компонента
  const serialized = questions.map((q) => ({
    ...q,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));

  return <KnowledgeBase initialQuestions={serialized} initialProfessions={professions} />;
}
