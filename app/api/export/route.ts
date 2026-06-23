import { prisma } from "@/lib/prisma";

export async function GET() {
  const questions = await prisma.question.findMany({
    orderBy: [{ profession: "asc" }, { topic: "asc" }, { createdAt: "asc" }],
  });

  const payload = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    questions,
  };

  const date = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kb-backup-${date}.json"`,
    },
  });
}
