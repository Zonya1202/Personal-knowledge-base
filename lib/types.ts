export type Question = {
  id: string;
  profession: string;
  topic: string;
  subtopic: string;
  question: string;
  answer: string;
  level: number;
  createdAt: string;
  updatedAt: string;
};

export type QuestionsResponse = {
  questions: Question[];
  professions: string[];
  totalCount: number;
};

export const MAX_LEVEL = 5;
