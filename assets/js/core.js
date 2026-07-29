export function normalizeText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('fil-PH')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”‘’'"!?.,;:()[\]{}]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function exerciseEnglish(item) {
  return String(item?.exercise_english || item?.english || '').trim();
}

export function explanationText(item) {
  if (item?.explanation) return String(item.explanation).trim();
  const base = `${String(item?.tagalog || '').trim()} — ${String(item?.english || '').trim()}`;
  return item?.note ? `${base} ${String(item.note).trim()}` : base;
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const sample = Number(random());
    const bounded = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.9999999999999999) : 0;
    const swapIndex = Math.floor(bounded * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function defaultProgress() {
  return {
    lessonComplete: false,
    familiar: [],
    review: {},
    typingCorrect: [],
    typingAttempts: 0,
    quizBest: null,
    missionComplete: false,
    missionChecks: {},
    updatedAt: new Date(0).toISOString()
  };
}

function validDate(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function normalizeProgress(raw, allowedIds = []) {
  const base = defaultProgress();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const allowed = new Set(allowedIds);
  const uniqueAllowed = value => Array.isArray(value)
    ? [...new Set(value.filter(id => typeof id === 'string' && allowed.has(id)))]
    : [];

  const review = {};
  if (raw.review && typeof raw.review === 'object' && !Array.isArray(raw.review)) {
    for (const [id, record] of Object.entries(raw.review)) {
      if (!allowed.has(id) || !record || typeof record !== 'object' || Array.isArray(record)) continue;
      const due = validDate(record.due);
      const interval = Number(record.interval);
      const repetitions = Number(record.repetitions);
      review[id] = {
        due: due || new Date(0).toISOString(),
        interval: Number.isFinite(interval) && interval >= 0 ? Math.min(interval, 365) : 0,
        repetitions: Number.isInteger(repetitions) && repetitions >= 0 ? Math.min(repetitions, 1000) : 0,
        lastRating: ['again', 'hard', 'good'].includes(record.lastRating) ? record.lastRating : null
      };
    }
  }

  const checks = {};
  if (raw.missionChecks && typeof raw.missionChecks === 'object' && !Array.isArray(raw.missionChecks)) {
    for (const [key, value] of Object.entries(raw.missionChecks)) {
      if (/^\d{1,2}$/.test(key) && typeof value === 'boolean') checks[key] = value;
    }
  }

  const quiz = raw.quizBest === null || raw.quizBest === undefined ? null : Number(raw.quizBest);
  const attempts = Number(raw.typingAttempts);
  return {
    lessonComplete: raw.lessonComplete === true,
    familiar: uniqueAllowed(raw.familiar),
    review,
    typingCorrect: uniqueAllowed(raw.typingCorrect),
    typingAttempts: Number.isInteger(attempts) && attempts >= 0 ? Math.min(attempts, 100000) : 0,
    quizBest: quiz !== null && Number.isFinite(quiz) ? Math.max(0, Math.min(100, Math.round(quiz))) : null,
    missionComplete: raw.missionComplete === true,
    missionChecks: checks,
    updatedAt: validDate(raw.updatedAt) || new Date(0).toISOString()
  };
}

export function mergeItemProgress(current, migrated, allowedIds = []) {
  const left = normalizeProgress(current, allowedIds);
  const right = normalizeProgress(migrated, allowedIds);
  return normalizeProgress({
    ...left,
    familiar: [...left.familiar, ...right.familiar],
    review: {...right.review, ...left.review},
    typingCorrect: [...left.typingCorrect, ...right.typingCorrect],
    updatedAt: left.updatedAt
  }, allowedIds);
}

export function progressPercent(progress, vocabularyCount) {
  if (!vocabularyCount) return 0;
  const familiar = Math.min(progress.familiar.length / vocabularyCount, 1);
  const typing = Math.min(progress.typingCorrect.length / vocabularyCount, 1);
  const reviewRecords = Object.values(progress.review || {});
  const review = reviewRecords.length
    ? reviewRecords.reduce((sum, item) => sum + Math.min((item.repetitions || 0) / 3, 1), 0) / vocabularyCount
    : 0;
  const quiz = progress.quizBest == null ? 0 : progress.quizBest / 100;
  const result = familiar * 30 + typing * 25 + Math.min(review, 1) * 20 + quiz * 15
    + (progress.lessonComplete ? 5 : 0) + (progress.missionComplete ? 5 : 0);
  return Math.max(0, Math.min(100, Math.round(result)));
}

export function scheduleReview(previous = {}, rating, now = Date.now()) {
  const repetitions = Number.isInteger(previous.repetitions) ? previous.repetitions : 0;
  let nextRepetitions = repetitions;
  let intervalDays = 0;
  let dueMs = now;
  if (rating === 'again') {
    nextRepetitions = 0;
    dueMs = now + 10 * 60 * 1000;
  } else if (rating === 'hard') {
    nextRepetitions = Math.max(1, repetitions);
    intervalDays = 1;
    dueMs = now + 24 * 60 * 60 * 1000;
  } else {
    nextRepetitions = repetitions + 1;
    const sequence = [1, 3, 7, 14, 30, 60, 120];
    intervalDays = sequence[Math.min(nextRepetitions - 1, sequence.length - 1)];
    dueMs = now + intervalDays * 24 * 60 * 60 * 1000;
  }
  return {
    due: new Date(dueMs).toISOString(),
    interval: intervalDays,
    repetitions: nextRepetitions,
    lastRating: rating
  };
}

export function dueItems(vocabulary, progress, limit = 12, now = Date.now()) {
  return vocabulary
    .filter(item => item.practice)
    .map(item => {
      const record = progress.review[item.id];
      return {item, due: !record || Date.parse(record.due) <= now, repetitions: record?.repetitions || 0, dueAt: record ? Date.parse(record.due) : 0};
    })
    .filter(row => row.due)
    .sort((a, b) => a.repetitions - b.repetitions || a.dueAt - b.dueAt || a.item.id.localeCompare(b.item.id))
    .slice(0, limit)
    .map(row => row.item);
}

function uniqueNormalized(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function makeQuiz(vocabulary, count = 10, random = Math.random) {
  const items = vocabulary.filter(item => item.practice);
  const selected = shuffle(items, random).slice(0, Math.min(count, items.length));
  return selected.map((item, index) => {
    const reverse = index % 2 === 1;
    const itemPrompt = exerciseEnglish(item);
    const pool = items.filter(other => other.id !== item.id
      && normalizeText(exerciseEnglish(other)) !== normalizeText(itemPrompt)
      && normalizeText(other.tagalog) !== normalizeText(item.tagalog));
    const distractors = shuffle(pool, random).slice(0, 3);
    const answerText = reverse ? itemPrompt : item.tagalog;
    const candidateChoices = [answerText, ...distractors.map(other => reverse ? exerciseEnglish(other) : other.tagalog)];
    const choices = shuffle(uniqueNormalized(candidateChoices), random);
    return {
      prompt: reverse ? `What does “${item.tagalog}” mean?` : `How do you say “${itemPrompt}” in Tagalog?`,
      choices,
      answer: choices.findIndex(choice => normalizeText(choice) === normalizeText(answerText)),
      explanation: explanationText(item),
      sourceId: item.id
    };
  });
}
