import { z } from "zod";

export const questionSchema = z.object({
  profession: z.string().trim().min(1, "Укажите профессию"),
  topic: z.string().trim().min(1, "Укажите тему"),
  subtopic: z.string().trim().min(1, "Укажите подтему"),
  question: z.string().trim().min(3, "Вопрос слишком короткий"),
  answer: z.string().trim().min(3, "Ответ слишком короткий"),
});

export const reviewSchema = z.object({
  grade: z.enum(["know", "unsure", "dont_know"]),
});

export type QuestionInput = z.infer<typeof questionSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
