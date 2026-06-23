export type Question = {
  id: string;
  profession: string;
  topic: string;
  subtopic: string;
  question: string;
  answer: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  nextReviewAt: string;
  intervalDays: number;
  repetition: number;
  easeFactor: number;
  knowCount: number;
  unsureCount: number;
  dontKnowCount: number;
};

export type QuestionsResponse = {
  questions: Question[];
  professions: string[];
  totalCount: number;
};
