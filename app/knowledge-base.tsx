"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Question, QuestionsResponse } from "@/lib/types";
import { MAX_LEVEL } from "@/lib/types";

type Mode = "library" | "review";
type Grade = "know" | "unsure" | "dont_know";
type SessionSize = 10 | 20 | 30 | "all";

type FormState = {
  profession: string;
  topic: string;
  subtopic: string;
  question: string;
  answer: string;
};

const emptyForm: FormState = {
  profession: "",
  topic: "",
  subtopic: "",
  question: "",
  answer: "",
};

// Вес карточки в лотерее выборки: чем ниже уровень, тем больше "билетиков".
// level 0 -> 6, level 5 -> 1. Выученное (5) сохраняет 1 билетик, чтобы иногда повторялось.
function weight(level: number) {
  return MAX_LEVEL + 1 - level;
}

// Взвешенная выборка size уникальных карточек (без повторов в сессии).
function buildSession(pool: Question[], size: number): Question[] {
  const items = [...pool];
  const result: Question[] = [];
  const count = Math.min(size, items.length);

  for (let i = 0; i < count; i++) {
    const total = items.reduce((sum, q) => sum + weight(q.level), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < items.length; j++) {
      r -= weight(items[j].level);
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    result.push(items[idx]);
    items.splice(idx, 1);
  }

  return result;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ru"));
}

export default function KnowledgeBase({
  initialQuestions,
  initialProfessions,
}: {
  initialQuestions: Question[];
  initialProfessions: string[];
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [professions, setProfessions] = useState<string[]>(initialProfessions);
  const [selectedProfession, setSelectedProfession] = useState<string>("all");
  const [mode, setMode] = useState<Mode>("library");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Сессия повторения
  const [session, setSession] = useState<Question[] | null>(null);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState({ know: 0, unsure: 0, dont_know: 0 });
  const [startProfession, setStartProfession] = useState<string>("all");
  const [startSize, setStartSize] = useState<SessionSize>(20);

  const importInputRef = useRef<HTMLInputElement>(null);

  const loadQuestions = async () => {
    try {
      const response = await fetch("/api/questions", { cache: "no-store" });
      const data: QuestionsResponse & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить вопросы");
      setQuestions(data.questions);
      setProfessions(data.professions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  };

  const filteredQuestions = useMemo(() => {
    if (selectedProfession === "all") return questions;
    return questions.filter((item) => item.profession === selectedProfession);
  }, [questions, selectedProfession]);

  const weakQuestions = useMemo(
    () => [...filteredQuestions].sort((a, b) => a.level - b.level).slice(0, 5),
    [filteredQuestions]
  );

  const selectedQuestion =
    questions.find((item) => item.id === selectedId) ?? null;

  // Каскадные списки для комбобоксов формы
  const professionOptions = useMemo(() => uniqueSorted(questions.map((q) => q.profession)), [questions]);
  const topicOptions = useMemo(
    () => uniqueSorted(questions.filter((q) => q.profession === form.profession).map((q) => q.topic)),
    [questions, form.profession]
  );
  const subtopicOptions = useMemo(
    () =>
      uniqueSorted(
        questions
          .filter((q) => q.profession === form.profession && q.topic === form.topic)
          .map((q) => q.subtopic)
      ),
    [questions, form.profession, form.topic]
  );

  const refreshForm = () => setFormKey((k) => k + 1);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    refreshForm();
  };

  const openNewForm = () => {
    resetForm();
    setMode("library");
    setFormOpen(true);
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
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить вопрос");

      const savedProfession = form.profession;
      resetForm();
      setFormOpen(false);
      await loadQuestions();
      setSelectedProfession(savedProfession || "all");
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
    refreshForm();
    setDetailsOpen(false);
    setMode("library");
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось удалить вопрос");
      if (selectedId === id) {
        setSelectedId(null);
        setDetailsOpen(false);
      }
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сбросить прогресс");
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сброса");
    } finally {
      setSaving(false);
    }
  };

  // --- Сессия повторения ---
  const startSession = () => {
    const pool =
      startProfession === "all"
        ? questions
        : questions.filter((q) => q.profession === startProfession);
    const size = startSize === "all" ? pool.length : startSize;
    const built = buildSession(pool, size);
    setSession(built);
    setSessionIndex(0);
    setShowAnswer(false);
    setResults({ know: 0, unsure: 0, dont_know: 0 });
  };

  const submitGrade = async (grade: Grade) => {
    if (!session) return;
    const current = session[sessionIndex];
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/questions/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", grade }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить оценку");

      setResults((prev) => ({ ...prev, [grade]: prev[grade] + 1 }));
      setShowAnswer(false);
      setSessionIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка повторения");
    } finally {
      setSaving(false);
    }
  };

  const finishSession = async () => {
    setSession(null);
    setSessionIndex(0);
    setShowAnswer(false);
    await loadQuestions();
  };

  const sessionDone = session !== null && sessionIndex >= session.length;
  const activeCard = session && !sessionDone ? session[sessionIndex] : null;

  // --- Экспорт / импорт ---
  const handleImportFile = async (file: File) => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Файл не является корректным JSON");
      }
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось импортировать базу");
      await loadQuestions();
      setNotice(`Импортировано карточек: ${data.imported}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 pb-28 pt-3 sm:px-5 lg:px-8 lg:py-6 lg:pb-6">
        {/* Шапка */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur sm:rounded-[28px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:text-[11px]">
                Personal knowledge base
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:mt-2 sm:text-4xl">
                База знаний
              </h1>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-zinc-400 sm:block">
                Повторяй вопросы когда хочешь, слабые карточки попадаются чаще.
              </p>
            </div>

            {/* Десктопные табы */}
            <div className="hidden gap-2 lg:flex">
              <TabButton active={mode === "library"} onClick={() => setMode("library")}>
                База
              </TabButton>
              <TabButton active={mode === "review"} onClick={() => setMode("review")}>
                Повторение
              </TabButton>
            </div>
          </div>

          <div
            className={clsx(
              "mt-4 flex-col gap-3 lg:flex lg:flex-row lg:items-center lg:justify-between",
              mode === "review" ? "hidden lg:flex" : "flex"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Профессия</span>
              <select
                value={selectedProfession}
                onChange={(event) => setSelectedProfession(event.target.value)}
                className="flex-1 rounded-2xl border border-white/10 bg-[#111113] px-4 py-3 text-sm text-zinc-100 outline-none lg:flex-none"
              >
                <option value="all">Все профессии</option>
                {professions.map((profession) => (
                  <option key={profession} value={profession}>
                    {profession}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/export"
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Скачать базу
              </a>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/10"
              >
                Загрузить базу
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>

          <div
            className={clsx(
              "mt-4 grid-cols-3 gap-2 sm:gap-3",
              mode === "review" ? "hidden lg:grid" : "grid"
            )}
          >
            <StatCard label="Всего" value={String(filteredQuestions.length)} />
            <StatCard
              label="Слабые"
              value={String(filteredQuestions.filter((q) => q.level <= 1).length)}
              accent
            />
            <StatCard label="Профессий" value={String(professions.length)} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

        {mode === "library" ? (
          <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
            {/* Форма: bottom sheet на мобиле, колонка на десктопе */}
            {formOpen ? (
              <div
                className="fixed inset-0 z-30 bg-black/60 lg:hidden"
                onClick={() => setFormOpen(false)}
              />
            ) : null}
            <form
              key={formKey}
              onSubmit={handleSubmit}
              className={clsx(
                "z-40 border border-white/10 bg-[#111113] p-4 transition-transform duration-300 sm:p-6",
                "fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px]",
                "lg:static lg:max-h-none lg:translate-y-0 lg:overflow-visible lg:rounded-[28px] lg:transition-none",
                formOpen ? "translate-y-0" : "translate-y-full"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">
                    {editingId ? "Редактирование" : "Новый вопрос"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Профессия, тема, подтема, вопрос, ответ.</p>
                </div>
                <div className="flex gap-2">
                  {editingId ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
                    >
                      Сброс
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 lg:hidden"
                  >
                    Закрыть
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <ComboBox
                  label="Профессия"
                  value={form.profession}
                  options={professionOptions}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, profession: value, topic: "", subtopic: "" }))
                  }
                />
                <ComboBox
                  label="Тема"
                  value={form.topic}
                  options={topicOptions}
                  onChange={(value) => setForm((prev) => ({ ...prev, topic: value, subtopic: "" }))}
                />
                <ComboBox
                  label="Подтема"
                  value={form.subtopic}
                  options={subtopicOptions}
                  onChange={(value) => setForm((prev) => ({ ...prev, subtopic: value }))}
                />
                <TextArea
                  label="Вопрос"
                  value={form.question}
                  onChange={(value) => setForm((prev) => ({ ...prev, question: value }))}
                  rows={4}
                />
                <TextArea
                  label="Ответ"
                  value={form.answer}
                  onChange={(value) => setForm((prev) => ({ ...prev, answer: value }))}
                  rows={6}
                />
              </div>

              <div className="sticky bottom-0 -mx-4 mt-4 border-t border-white/10 bg-[#111113] px-4 pb-[env(safe-area-inset-bottom)] pt-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Сохранение..." : editingId ? "Сохранить изменения" : "Сохранить"}
                </button>
              </div>
            </form>

            {/* Список карточек */}
            <div className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold sm:text-xl">Вопросы</h2>
                <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300">
                  {filteredQuestions.length}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {filteredQuestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
                    По текущему фильтру вопросов нет. Добавь карточку кнопкой «＋».
                  </div>
                ) : (
                  filteredQuestions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setDetailsOpen(true);
                      }}
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
                      </div>
                      <p className="mt-3 text-sm font-medium leading-6 text-zinc-100 sm:text-base">
                        {item.question}
                      </p>
                      <div className="mt-3">
                        <LevelBar level={item.level} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Детали: bottom sheet на мобиле, колонка на десктопе */}
            {detailsOpen ? (
              <div
                className="fixed inset-0 z-30 bg-black/60 xl:hidden"
                onClick={() => setDetailsOpen(false)}
              />
            ) : null}
            <div
              className={clsx(
                "z-40 border border-white/10 bg-[#111113] p-4 transition-transform duration-300 sm:p-6",
                "fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px]",
                "xl:static xl:max-h-none xl:translate-y-0 xl:overflow-visible xl:rounded-[28px] xl:transition-none",
                detailsOpen ? "translate-y-0" : "translate-y-full xl:translate-y-0"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold sm:text-xl">Детали</h2>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 xl:hidden"
                >
                  Закрыть
                </button>
              </div>

              {selectedQuestion ? (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Tag>{selectedQuestion.profession}</Tag>
                    <Tag>{selectedQuestion.topic}</Tag>
                    <Tag>{selectedQuestion.subtopic}</Tag>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Вопрос</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">
                      {selectedQuestion.question}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Ответ</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                      {selectedQuestion.answer}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Уровень освоения</p>
                    <div className="mt-2">
                      <LevelBar level={selectedQuestion.level} showText />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <button
                      onClick={() => handleEdit(selectedQuestion)}
                      className="w-full rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
                    >
                      Редактировать
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void handleReset(selectedQuestion.id)}
                        className="w-full whitespace-nowrap rounded-2xl bg-amber-500/10 px-3 py-3 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                      >
                        Сбросить
                      </button>
                      <button
                        onClick={() => void handleDelete(selectedQuestion.id)}
                        className="w-full rounded-2xl bg-red-500/10 px-3 py-3 text-sm font-medium text-red-200 hover:bg-red-500/20"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
                  Выбери вопрос из списка.
                </div>
              )}
            </div>
          </section>
        ) : (
          <ReviewView
            session={session}
            sessionDone={sessionDone}
            activeCard={activeCard}
            sessionIndex={sessionIndex}
            showAnswer={showAnswer}
            results={results}
            saving={saving}
            professions={professions}
            startProfession={startProfession}
            startSize={startSize}
            weakQuestions={weakQuestions}
            onChangeStartProfession={setStartProfession}
            onChangeStartSize={setStartSize}
            onStart={startSession}
            onShowAnswer={() => setShowAnswer(true)}
            onGrade={(grade) => void submitGrade(grade)}
            onFinish={() => void finishSession()}
            onRestart={() => {
              void (async () => {
                await loadQuestions();
                startSession();
              })();
            }}
          />
        )}
      </div>

      {/* Нижняя навигация (мобила) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0d0d0f]/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-3 px-2 pb-[env(safe-area-inset-bottom)]">
          <NavButton
            active={mode === "library" && !formOpen}
            label="База"
            icon="📚"
            onClick={() => {
              setMode("library");
              setFormOpen(false);
            }}
          />
          <NavButton
            active={mode === "review"}
            label="Повтор"
            icon="🔁"
            onClick={() => {
              setMode("review");
              setFormOpen(false);
            }}
          />
          <NavButton active={formOpen} label="Добавить" icon="＋" onClick={openNewForm} />
        </div>
      </nav>
    </main>
  );
}

// ---------- Review ----------

function ReviewView(props: {
  session: Question[] | null;
  sessionDone: boolean;
  activeCard: Question | null;
  sessionIndex: number;
  showAnswer: boolean;
  results: { know: number; unsure: number; dont_know: number };
  saving: boolean;
  professions: string[];
  startProfession: string;
  startSize: SessionSize;
  weakQuestions: Question[];
  onChangeStartProfession: (value: string) => void;
  onChangeStartSize: (value: SessionSize) => void;
  onStart: () => void;
  onShowAnswer: () => void;
  onGrade: (grade: Grade) => void;
  onFinish: () => void;
  onRestart: () => void;
}) {
  const {
    session,
    sessionDone,
    activeCard,
    sessionIndex,
    showAnswer,
    results,
    saving,
    professions,
    startProfession,
    startSize,
    weakQuestions,
    onChangeStartProfession,
    onChangeStartSize,
    onStart,
    onShowAnswer,
    onGrade,
    onFinish,
    onRestart,
  } = props;

  // Старт-экран
  if (session === null) {
    const sizes: SessionSize[] = [10, 20, 30, "all"];
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-white/10 bg-[#111113] p-5 sm:p-8">
          <h2 className="text-xl font-semibold sm:text-2xl">Новая сессия повторения</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Слабые карточки попадаются чаще. Без дублей внутри сессии.
          </p>

          <div className="mt-6 grid gap-2">
            <span className="text-sm text-zinc-400">Профессия</span>
            <select
              value={startProfession}
              onChange={(e) => onChangeStartProfession(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 outline-none"
            >
              <option value="all">Все профессии</option>
              {professions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 grid gap-2">
            <span className="text-sm text-zinc-400">Сколько карточек</span>
            <div className="grid grid-cols-4 gap-2">
              {sizes.map((s) => (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => onChangeStartSize(s)}
                  className={clsx(
                    "rounded-2xl px-3 py-3 text-sm font-medium transition",
                    startSize === s
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  )}
                >
                  {s === "all" ? "Все" : s}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="mt-6 w-full rounded-2xl bg-zinc-100 px-4 py-4 text-sm font-semibold text-zinc-950 transition hover:bg-white"
          >
            Начать сессию
          </button>
        </div>

        <aside className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-6">
          <h2 className="text-lg font-semibold sm:text-xl">Слабые места</h2>
          <div className="mt-4 space-y-3">
            {weakQuestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                Пока пусто.
              </div>
            ) : (
              weakQuestions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <p className="text-sm font-medium text-zinc-100">
                    {item.topic} / {item.subtopic}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.question}</p>
                  <div className="mt-3">
                    <LevelBar level={item.level} />
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    );
  }

  // Экран результата
  if (sessionDone) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#111113] p-6 sm:p-10">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Сессия завершена</p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Готово 🎉</h2>
          <p className="mt-2 text-sm text-zinc-400">Карточек пройдено: {session.length}</p>

          <div className="mt-6 grid w-full grid-cols-3 gap-3">
            <ResultStat label="Знаю" value={results.know} tone="success" />
            <ResultStat label="Не уверен" value={results.unsure} tone="warning" />
            <ResultStat label="Не знаю" value={results.dont_know} tone="danger" />
          </div>

          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-white"
            >
              Ещё раз
            </button>
            <button
              type="button"
              onClick={onFinish}
              className="flex-1 rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
            >
              Завершить
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Прохождение
  const card = activeCard!;
  const progress = ((sessionIndex + 1) / session.length) * 100;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#111113] p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-400">
          {sessionIndex + 1} / {session.length}
        </span>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
        >
          Прервать
        </button>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-zinc-100 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-6 flex min-h-[60vh] flex-col justify-between gap-5 lg:min-h-[420px]">
        <div>
          <div className="flex flex-wrap gap-2">
            <Tag>{card.profession}</Tag>
            <Tag>{card.topic}</Tag>
            <Tag>{card.subtopic}</Tag>
          </div>
          <h2 className="mt-5 text-2xl font-semibold leading-tight sm:text-3xl">{card.question}</h2>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          {showAnswer ? (
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Ответ</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300 sm:text-base">
                {card.answer}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm leading-6 text-zinc-400">
                Сначала ответь сам, потом открой правильный ответ.
              </p>
              <button
                type="button"
                onClick={onShowAnswer}
                className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-white sm:w-auto"
              >
                Показать ответ
              </button>
            </div>
          )}
        </div>

        {showAnswer ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <ReviewButton tone="danger" disabled={saving} onClick={() => onGrade("dont_know")}>
              Не знаю
            </ReviewButton>
            <ReviewButton tone="warning" disabled={saving} onClick={() => onGrade("unsure")}>
              Не уверен
            </ReviewButton>
            <ReviewButton tone="success" disabled={saving} onClick={() => onGrade("know")}>
              Знаю
            </ReviewButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ---------- UI helpers ----------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm font-medium transition",
        active ? "bg-zinc-100 text-zinc-950" : "bg-white/5 text-zinc-300 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition",
        active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-3 sm:p-4",
        accent ? "border-zinc-200/20 bg-zinc-100 text-zinc-950" : "border-white/10 bg-white/[0.03]"
      )}
    >
      <p className={clsx("text-xs sm:text-sm", accent ? "text-zinc-700" : "text-zinc-500")}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
      {children}
    </span>
  );
}

function LevelBar({ level, showText = false }: { level: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {Array.from({ length: MAX_LEVEL }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "h-1.5 w-5 rounded-full",
              i < level ? "bg-emerald-400/80" : "bg-white/10"
            )}
          />
        ))}
      </div>
      {showText ? (
        <span className="text-xs text-zinc-400">
          {level} / {MAX_LEVEL}
        </span>
      ) : null}
    </div>
  );
}

function ComboBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const showInput = creating || options.length === 0;

  return (
    <label className="grid gap-2">
      <span className="text-sm text-zinc-400">{label}</span>
      {showInput ? (
        <div className="flex gap-2">
          <input
            value={value}
            autoFocus={creating}
            placeholder="Новое значение"
            onChange={(event) => onChange(event.target.value)}
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-300/40"
          />
          {options.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                onChange("");
              }}
              className="rounded-2xl bg-white/5 px-3 text-sm text-zinc-300 hover:bg-white/10"
            >
              Список
            </button>
          ) : null}
        </div>
      ) : (
        <select
          value={options.includes(value) ? value : ""}
          onChange={(event) => {
            if (event.target.value === "__new__") {
              setCreating(true);
              onChange("");
            } else {
              onChange(event.target.value);
            }
          }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-300/40"
        >
          <option value="" disabled>
            — выбери —
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="__new__">➕ Новое…</option>
        </select>
      )}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
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

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4",
        tone === "success" && "border-emerald-500/20 bg-emerald-500/10",
        tone === "warning" && "border-amber-500/20 bg-amber-500/10",
        tone === "danger" && "border-red-500/20 bg-red-500/10"
      )}
    >
      <p
        className={clsx(
          "text-xs",
          tone === "success" && "text-emerald-200",
          tone === "warning" && "text-amber-200",
          tone === "danger" && "text-red-200"
        )}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function ReviewButton({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "danger" | "warning" | "success";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-2xl px-4 py-4 text-sm font-semibold transition disabled:opacity-50",
        tone === "danger" && "bg-red-500/12 text-red-200 hover:bg-red-500/20",
        tone === "warning" && "bg-amber-500/12 text-amber-200 hover:bg-amber-500/20",
        tone === "success" && "bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20"
      )}
    >
      {children}
    </button>
  );
}
