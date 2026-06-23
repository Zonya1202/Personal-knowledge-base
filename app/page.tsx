"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import clsx from "clsx";
import type { Question, QuestionsResponse } from "@/lib/types";

type Mode = "library" | "review";
type Grade = "know" | "unsure" | "dont_know";

type FormState = {
  profession: string;
  topic: string;
  subtopic: string;
  question: string;
  answer: string;
};

const emptyForm: FormState = {
  profession: "Frontend",
  topic: "React",
  subtopic: "Hooks",
  question: "",
  answer: "",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return format(new Date(date), "d MMM yyyy", { locale: ru });
}

function getWeaknessScore(question: Question) {
  return question.dontKnowCount * 3 + question.unsureCount * 2 - question.knowCount;
}

function buildReviewQueue(questions: Question[]) {
  if (questions.length === 0) {
    return [] as Question[];
  }

  const pool = questions.flatMap((question) => {
    const repeats = Math.max(1, 1 + question.dontKnowCount * 3 + question.unsureCount * 2);
    return Array.from({ length: repeats }, () => question);
  });

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(10, questions.length));
}

export default function HomePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [professions, setProfessions] = useState<string[]>([]);
  const [selectedProfession, setSelectedProfession] = useState<string>("all");
  const [mode, setMode] = useState<Mode>("library");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/questions", { cache: "no-store" });
      const data: QuestionsResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить вопросы");
      }

      setQuestions(data.questions);
      setProfessions(data.professions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadQuestions();
    };

    void run();
  }, []);

  const filteredQuestions = useMemo(() => {
    if (selectedProfession === "all") {
      return questions;
    }

    return questions.filter((item) => item.profession === selectedProfession);
  }, [questions, selectedProfession]);

  const weakQuestions = useMemo(
    () => [...filteredQuestions].sort((a, b) => getWeaknessScore(b) - getWeaknessScore(a)).slice(0, 5),
    [filteredQuestions]
  );

  const reviewQueue = useMemo(() => buildReviewQueue(filteredQuestions), [filteredQuestions]);

  const activeQuestion = reviewQueue[0] ?? null;
  const selectedQuestion =
    filteredQuestions.find((item) => item.id === selectedId) ?? filteredQuestions[0] ?? null;
  const weakCount = filteredQuestions.filter((item) => item.dontKnowCount > 0 || item.unsureCount > 0).length;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(editingId ? `/api/questions/${editingId}` : "/api/questions", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить вопрос");
      }

      resetForm();
      await loadQuestions();
      setSelectedProfession(form.profession || "all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: Question) => {
    setForm({
      profession: item.profession,
      topic: item.topic,
      subtopic: item.subtopic,
      question: item.question,
      answer: item.answer,
    });
    setEditingId(item.id);
    setMode("library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось удалить вопрос");
      }

      if (selectedId === id) {
        setSelectedId(null);
      }

      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (grade: Grade) => {
    if (!activeQuestion) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/questions/${activeQuestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить оценку");
      }

      setShowAnswer(false);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка повторения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 py-3 sm:px-5 lg:px-8 lg:py-6">
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Personal knowledge base</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                Личная база знаний для техсобеседований
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Повторяй вопросы в любое время, а слабые карточки будут попадаться чаще.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <button
                onClick={() => setMode("library")}
                className={clsx(
                  "rounded-2xl px-4 py-3 text-sm font-medium transition",
                  mode === "library" ? "bg-zinc-100 text-zinc-950" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                )}
              >
                База
              </button>
              <button
                onClick={() => setMode("review")}
                className={clsx(
                  "rounded-2xl px-4 py-3 text-sm font-medium transition",
                  mode === "review" ? "bg-zinc-100 text-zinc-950" : "bg-white/5 text-zinc-300 hover:bg-white/10"
                )}
              >
                Повторение
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-sm text-zinc-400">Профессия</span>
              <select
                value={selectedProfession}
                onChange={(event) => {
                  setSelectedProfession(event.target.value);
                }}
                className="rounded-2xl border border-white/10 bg-[#111113] px-4 py-3 text-sm text-zinc-100 outline-none"
              >
                <option value="all">Все профессии</option>
                {professions.map((profession) => (
                  <option key={profession} value={profession}>
                    {profession}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[420px]">
              <StatCard label="Всего" value={String(filteredQuestions.length)} />
              <StatCard label="Слабые" value={String(weakCount)} accent />
              <StatCard label="Профессий" value={String(professions.length)} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {mode === "library" ? (
          <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <form onSubmit={handleSubmit} className="order-1 rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">{editingId ? "Редактирование" : "Новый вопрос"}</h2>
                  <p className="mt-1 text-sm text-zinc-500">Добавляй карточки без лишних шагов.</p>
                </div>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
                  >
                    Отмена
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4">
                <Field label="Профессия" value={form.profession} onChange={(value) => setForm((prev) => ({ ...prev, profession: value }))} />
                <Field label="Тема" value={form.topic} onChange={(value) => setForm((prev) => ({ ...prev, topic: value }))} />
                <Field label="Подтема" value={form.subtopic} onChange={(value) => setForm((prev) => ({ ...prev, subtopic: value }))} />
                <TextArea label="Вопрос" value={form.question} onChange={(value) => setForm((prev) => ({ ...prev, question: value }))} rows={4} />
                <TextArea label="Ответ" value={form.answer} onChange={(value) => setForm((prev) => ({ ...prev, answer: value }))} rows={6} />
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-1 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Сохранение..." : editingId ? "Сохранить изменения" : "Сохранить"}
                </button>
              </div>
            </form>

            <div className="order-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold sm:text-xl">Вопросы</h2>
                    <p className="mt-1 text-sm text-zinc-500">Фильтр по профессии применяется и к базе, и к повторению.</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300">{filteredQuestions.length}</div>
                </div>

                <div className="mt-5 grid gap-3">
                  {loading ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">Загрузка...</div>
                  ) : filteredQuestions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
                      По текущему фильтру вопросов нет.
                    </div>
                  ) : (
                    filteredQuestions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={clsx(
                          "rounded-2xl border p-4 text-left transition",
                          selectedId === item.id
                            ? "border-zinc-300/70 bg-white/[0.07]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag>{item.profession}</Tag>
                          <Tag>{item.topic}</Tag>
                          <Tag>{item.subtopic}</Tag>
                          {item.dontKnowCount + item.unsureCount > 0 ? (
                            <Tag tone="danger">Слабое место</Tag>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-medium leading-6 text-zinc-100 sm:text-base">{item.question}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{item.answer}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-6">
                <h2 className="text-lg font-semibold sm:text-xl">Детали</h2>
                {selectedQuestion ? (
                  <div className="mt-5 space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <Tag>{selectedQuestion.profession}</Tag>
                      <Tag>{selectedQuestion.topic}</Tag>
                      <Tag>{selectedQuestion.subtopic}</Tag>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Вопрос</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{selectedQuestion.question}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-500">Ответ</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{selectedQuestion.answer}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-zinc-400">
                      <Info label="Последний просмотр" value={formatDate(selectedQuestion.lastReviewedAt)} />
                      <Info label="Знаю" value={String(selectedQuestion.knowCount)} />
                      <Info label="Не уверен" value={String(selectedQuestion.unsureCount)} />
                      <Info label="Не знаю" value={String(selectedQuestion.dontKnowCount)} />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => handleEdit(selectedQuestion)}
                        className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => void handleDelete(selectedQuestion.id)}
                        className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200 hover:bg-red-500/20"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
                    Выбери вопрос из списка.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-8">
              {!activeQuestion ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                  <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Пусто</p>
                  <h2 className="mt-3 text-2xl font-semibold">Нет вопросов для повторения</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
                    Добавь карточки или сними фильтр по профессии.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Tag>{activeQuestion.profession}</Tag>
                      <Tag>{activeQuestion.topic}</Tag>
                      <Tag>{activeQuestion.subtopic}</Tag>
                    </div>
                    <p className="mt-5 text-xs uppercase tracking-[0.24em] text-zinc-500">
                      Повторение без ограничений · слабые карточки встречаются чаще
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                      {activeQuestion.question}
                    </h2>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    {showAnswer ? (
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Ответ</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300 sm:text-base">
                          {activeQuestion.answer}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm leading-6 text-zinc-400">Сначала ответь сам, затем открой правильный ответ.</p>
                        <button
                          onClick={() => setShowAnswer(true)}
                          className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-white sm:w-auto"
                        >
                          Показать ответ
                        </button>
                      </div>
                    )}
                  </div>

                  {showAnswer ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ReviewButton tone="danger" onClick={() => void submitReview("dont_know")}>Не знаю</ReviewButton>
                      <ReviewButton tone="warning" onClick={() => void submitReview("unsure")}>Не уверен</ReviewButton>
                      <ReviewButton tone="success" onClick={() => void submitReview("know")}>Знаю</ReviewButton>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-6">
              <h2 className="text-lg font-semibold sm:text-xl">Слабые места</h2>
              <div className="mt-4 space-y-3">
                {weakQuestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                    Пока нет накопленной статистики по ошибкам.
                  </div>
                ) : (
                  weakQuestions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMode("library");
                        setSelectedId(item.id);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
                    >
                      <p className="text-sm font-medium text-zinc-100">{item.topic} / {item.subtopic}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.question}</p>
                      <p className="mt-3 text-xs text-red-300">
                        Не уверен: {item.unsureCount} · Не знаю: {item.dontKnowCount}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={clsx("rounded-2xl border p-3 sm:p-4", accent ? "border-zinc-200/20 bg-zinc-100 text-zinc-950" : "border-white/10 bg-white/[0.03]") }>
      <p className={clsx("text-xs sm:text-sm", accent ? "text-zinc-700" : "text-zinc-500")}>{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl">{value}</p>
    </div>
  );
}

function Tag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <span
      className={clsx(
        "rounded-full border px-2.5 py-1 text-xs",
        tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-200"
          : "border-white/10 bg-white/[0.04] text-zinc-400"
      )}
    >
      {children}
    </span>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-300/40"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-300/40"
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">{label}</p>
      <p className="mt-2 text-sm text-zinc-200">{value}</p>
    </div>
  );
}

function ReviewButton({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: "danger" | "warning" | "success" }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-2xl px-4 py-4 text-sm font-semibold transition",
        tone === "danger" && "bg-red-500/12 text-red-200 hover:bg-red-500/20",
        tone === "warning" && "bg-amber-500/12 text-amber-200 hover:bg-amber-500/20",
        tone === "success" && "bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
      )}
    >
      {children}
    </button>
  );
}
