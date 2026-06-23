export type ReviewGrade = "know" | "unsure" | "dont_know";

export type ReviewStats = {
  intervalDays: number;
  repetition: number;
  easeFactor: number;
  nextReviewAt: Date;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function calculateReview(grade: ReviewGrade, current?: {
  intervalDays: number;
  repetition: number;
  easeFactor: number;
}): ReviewStats {
  const intervalDays = current?.intervalDays ?? 0;
  const repetition = current?.repetition ?? 0;
  const easeFactor = current?.easeFactor ?? 2.5;

  let nextInterval = 1;
  let nextRepetition = repetition;
  let nextEaseFactor = easeFactor;

  if (grade === "dont_know") {
    nextRepetition = 0;
    nextInterval = 1;
    nextEaseFactor = clamp(easeFactor - 0.3, 1.3, 2.5);
  }

  if (grade === "unsure") {
    nextRepetition = Math.max(0, repetition - 1);
    nextInterval = Math.max(1, Math.round(Math.max(2, intervalDays * 0.6 || 2)));
    nextEaseFactor = clamp(easeFactor - 0.15, 1.3, 2.5);
  }

  if (grade === "know") {
    nextRepetition = repetition + 1;
    nextEaseFactor = clamp(easeFactor + 0.1, 1.3, 3.0);

    if (nextRepetition === 1) {
      nextInterval = 1;
    } else if (nextRepetition === 2) {
      nextInterval = 3;
    } else {
      nextInterval = Math.round(Math.max(4, intervalDays * nextEaseFactor));
    }
  }

  const nextReviewAt = new Date();
  nextReviewAt.setHours(0, 0, 0, 0);
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  return {
    intervalDays: nextInterval,
    repetition: nextRepetition,
    easeFactor: nextEaseFactor,
    nextReviewAt,
  };
}

export function isDue(nextReviewAt: Date) {
  return nextReviewAt.getTime() <= Date.now();
}
