import { z } from "zod";

export const questionSchema = z.object({
  profession: z.string().trim().min(1, "Укажите профессию"),
  topic: z.string().trim().min(1, "Укажите тему"),
  subtopic: z.string().trim().min(1, "Укажите подтему"),
  question: z.string().trim().min(3, "Вопрос слишком короткий"),
  answer: z.string().trim().min(3, "Ответ слишком короткий"),
});

export const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review"), grade: z.enum(["know", "unsure", "dont_know"]) }),
  z.object({ action: z.literal("reset") }),
]);

export const importSchema = z.object({
  version: z.literal(1),
  questions: z.array(
    questionSchema.extend({
      id: z.string().min(1),
      level: z.number().int().min(0).max(5).optional(),
    })
  ),
});

export type QuestionInput = z.infer<typeof questionSchema>;
export type PatchInput = z.infer<typeof patchSchema>;
export type ImportInput = z.infer<typeof importSchema>;
