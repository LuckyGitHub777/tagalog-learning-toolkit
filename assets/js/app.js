import {
  normalizeText,
  defaultProgress,
  normalizeProgress,
  mergeItemProgress,
  progressPercent,
  scheduleReview,
  dueItems,
  exerciseEnglish,
  shuffle,
  makeQuiz
} from './core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const SETTINGS_KEY = 'tagalog-academy.settings';
const PROGRESS_PREFIX = 'tagalog-academy.v4.progress.';
const LEGACY_PREFIX = 'tagalog-academy.progress.';

const memoryStore = new Map();
const safeStorage = {
  getItem(key) { try { return localStorage.getItem(key); } catch { return memoryStore.get(key) ?? null; } },
  setItem(key, value) { try { localStorage.setItem(key, String(value)); } catch { memoryStore.set(key, String(value)); } },
  removeItem(key) { try { localStorage.removeItem(key); } catch { memoryStore.delete(key); } }
};

const state = {
  catalog: null,
  lessonMeta: null,
  lesson: null,
  lessons: new Map(),
  progress: null,
  reviewItems: [],
  reviewIndex: 0,
  typingItems: [],
  typingIndex: 0,
  quiz: [],
  quizIndex: 0,
  quizScore: 0,
  quizAnswered: false,
  failedLessonId: null,
  deferredPrompt: null,
  mediaRecorder: null,
  mediaChunks: [],
  recordingUrl: null,
  warnedVoice: false
};

let voiceCache = [];
function refreshVoices() { voiceCache = speechSynthesis?.getVoices?.() || []; }
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function settings() {
  try { const value = JSON.parse(safeStorage.getItem(SETTINGS_KEY)); return value && typeof value === 'object' ? value : {}; }
  catch { return {}; }
}
function saveSettings(patch) { safeStorage.setItem(SETTINGS_KEY, JSON.stringify({...settings(), ...patch})); }
function progressKey(id) { return `${PROGRESS_PREFIX}${id}`; }
function allowedIds(lesson) { return lesson.vocabulary.filter(item => item.practice).map(item => item.id); }

function loadProgress(id, lesson) {
  const rawText = safeStorage.getItem(progressKey(id));
  if (!rawText) return defaultProgress();
  try {
    const raw = JSON.parse(rawText);
    const normalized = normalizeProgress(raw, allowedIds(lesson));
    safeStorage.setItem(progressKey(id), JSON.stringify(normalized));
    return normalized;
  } catch {
    const clean = defaultProgress();
    safeStorage.setItem(progressKey(id), JSON.stringify(clean));
    showGlobalFeedback('Saved progress for this lesson was repaired. You can continue learning.', 'error');
    return clean;
  }
}

function saveProgress() {
  if (!state.lessonMeta || !state.progress) return;
  state.progress = normalizeProgress({...state.progress, updatedAt: new Date().toISOString()}, allowedIds(state.lesson));
  safeStorage.setItem(progressKey(state.lessonMeta.id), JSON.stringify(state.progress));
  updateDashboard();
  renderLessonGrid();
}

async function getJson(url) {
  const response = await fetch(url, {cache: 'no-store'});
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

async function getLesson(meta) {
  if (state.lessons.has(meta.id)) return state.lessons.get(meta.id);
  const lesson = await getJson(meta.file);
  state.lessons.set(meta.id, lesson);
  return lesson;
}

function showGlobalFeedback(message, type = '', retry = false) {
  const box = $('#global-feedback');
  $('#global-feedback-text').textContent = message;
  box.className = `global-feedback ${type}`.trim();
  box.hidden = false;
  $('#retry-load').hidden = !retry;
  if (!retry) setTimeout(() => { box.hidden = true; }, 7000);
}
function hideGlobalFeedback() { $('#global-feedback').hidden = true; $('#retry-load').hidden = true; }
function feedback(element, message, type = '') { element.textContent = message; element.className = `feedback ${type}`.trim(); }

function legacyTranslate(raw, idMap) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const copy = {familiar: [], review: {}, typingCorrect: []};
  for (const field of ['familiar','typingCorrect']) {
    if (Array.isArray(raw[field])) copy[field] = raw[field].map(id => idMap[id] || id);
  }
  if (raw.review && typeof raw.review === 'object' && !Array.isArray(raw.review)) {
    copy.review = Object.fromEntries(Object.entries(raw.review).map(([id, value]) => [idMap[id] || id, value]));
  }
  return copy;
}

function migrateLegacyProgress() {
  if (settings().v4ItemMigrationComplete) return;
  const routes = {
    week1: ['greetings-introductions','people-family'],
    week2: ['colors-preferences','food-drinks'],
    week3: ['home-location'],
    week4: ['people-family','numbers-quantities','fruit-market']
  };
  const idMap = {
    mother:'mother-nanay', father:'father-tatay', uncle:'uncle-tito', aunt:'aunt-tita',
    blue:'blue-asul', green:'green-berde', purple:'purple-lila', pink:'pink-rosas',
    'orange-color':'orange-kahel', gray:'gray-kulay-abo', plate:'plate-plato'
  };
  for (const [legacyId, targetIds] of Object.entries(routes)) {
    const rawText = safeStorage.getItem(`${LEGACY_PREFIX}${legacyId}`);
    if (!rawText) continue;
    try {
      const translated = legacyTranslate(JSON.parse(rawText), idMap);
      for (const targetId of targetIds) {
        const lesson = state.lessons.get(targetId);
        if (!lesson) continue;
        const ids = allowedIds(lesson);
        const currentText = safeStorage.getItem(progressKey(targetId));
        const current = currentText ? JSON.parse(currentText) : defaultProgress();
        safeStorage.setItem(progressKey(targetId), JSON.stringify(mergeItemProgress(current, translated, ids)));
      }
      safeStorage.removeItem(`${LEGACY_PREFIX}${legacyId}`);
    } catch { /* legacy data is optional */ }
  }
  saveSettings({v4Migrated: true, v4ItemMigrationComplete: true});
}

async function preloadLessons() {
  const results = await Promise.allSettled(state.catalog.lessons.map(async meta => {
    const lesson = await getJson(meta.file);
    state.lessons.set(meta.id, lesson);
  }));
  const failed = results.filter(item => item.status === 'rejected').length;
  if (failed) showGlobalFeedback(`${failed} lesson file${failed === 1 ? '' : 's'} could not be preloaded. Available lessons still work.`, 'error');
}

async function init() {
  bindEvents();
  applyThemeLabel();
  try {
    state.catalog = await getJson('data/catalog.json');
    await preloadLessons();
    migrateLegacyProgress();
    populateLessonSelect();
    const preferred = state.catalog.lessons.find(item => item.id === settings().currentLesson) || firstIncompleteLesson() || state.catalog.lessons[0];
    await loadLesson(preferred.id, false);
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    showGlobalFeedback('The learning files could not load. Check your connection and try again.', 'error', true);
  }
}

function firstIncompleteLesson() {
  return state.catalog.lessons.find(meta => {
    const lesson = state.lessons.get(meta.id);
    return lesson && !loadProgress(meta.id, lesson).lessonComplete;
  });
}

function nextLessonMeta(id = state.lessonMeta?.id) {
  const index = state.catalog?.lessons.findIndex(meta => meta.id === id) ?? -1;
  return index >= 0 ? state.catalog.lessons[index + 1] || null : null;
}

async function continueLearning() {
  if (!state.lessonMeta || !state.progress) return;
  if (!state.progress.lessonComplete) {
    openPanel('learn');
    return;
  }
  const target = nextLessonMeta() || firstIncompleteLesson();
  if (target && target.id !== state.lessonMeta.id) await loadLesson(target.id, false);
  openPanel(target ? 'learn' : 'practice');
  if (!target) showGlobalFeedback('You completed the learning path. Keep strengthening it through practice.');
}

function populateLessonSelect() {
  $('#lesson-select').innerHTML = state.catalog.lessons.map(meta => `<option value="${escapeHtml(meta.id)}">Lesson ${meta.order}: ${escapeHtml(meta.title)}</option>`).join('');
  renderLessonGrid();
}

async function loadLesson(id, announce = true) {
  const meta = state.catalog.lessons.find(item => item.id === id);
  if (!meta) return;
  const previousId = state.lessonMeta?.id || null;
  try {
    const lesson = await getLesson(meta);
    state.lessonMeta = meta;
    state.lesson = lesson;
    state.progress = loadProgress(id, lesson);
    state.reviewIndex = 0;
    state.typingIndex = 0;
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    state.failedLessonId = null;
    saveSettings({currentLesson: id});
    $('#lesson-select').value = id;
    hideGlobalFeedback();
    renderAll();
    prepareReview();
    prepareTyping();
    prepareQuiz();
    if (announce) {
      showGlobalFeedback(`${meta.title} opened.`);
      openPanel('learn');
    }
  } catch (error) {
    console.error(error);
    state.failedLessonId = id;
    $('#lesson-select').value = previousId || '';
    showGlobalFeedback(`“${meta.title}” could not load. Your current lesson is still open.`, 'error', true);
  }
}

function renderAll() {
  renderLessonHeader();
  renderLessonGrid();
  renderObjectives();
  renderVocabulary();
  renderPatterns();
  renderSpeakOptions();
  renderBuilders();
  renderMission();
  renderResources();
  updateLessonButton();
  updateDashboard();
}

function renderLessonHeader() {
  $('#lesson-position').textContent = `Lesson ${state.lessonMeta.order} of ${state.catalog.lessons.length}`;
  $('#active-lesson-title').textContent = state.lesson.title;
  $('#active-lesson-summary').textContent = state.lesson.summary;
  $('#dashboard-title').textContent = state.lesson.title;
  $('#dashboard-summary').textContent = state.lesson.summary;
}

function renderLessonGrid() {
  if (!state.catalog) return;
  $('#lesson-grid').innerHTML = state.catalog.lessons.map(meta => {
    const lesson = state.lessons.get(meta.id);
    const progress = lesson ? loadProgress(meta.id, lesson) : defaultProgress();
    const percent = lesson ? progressPercent(progress, lesson.vocabulary.filter(item => item.practice).length) : 0;
    const active = state.lessonMeta?.id === meta.id;
    const complete = progress.lessonComplete;
    const status = complete ? 'Done ✓' : `${percent}%`;
    return `<button type="button" class="lesson-card ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}" data-lesson-id="${escapeHtml(meta.id)}" ${active ? 'aria-current="step"' : ''} aria-label="Lesson ${meta.order}: ${escapeHtml(meta.title)}, ${percent}% progress${complete ? ', marked done' : ''}">
      <span class="lesson-card-meta"><small>Lesson ${meta.order}</small><span class="lesson-status">${status}</span></span>
      <strong>${escapeHtml(meta.title)}</strong><span>${escapeHtml(meta.summary)}</span>
      <span class="mini-progress" aria-hidden="true"><i style="width:${percent}%"></i></span>
    </button>`;
  }).join('');
}

function updateDashboard() {
  if (!state.lesson) return;
  const count = state.lesson.vocabulary.filter(item => item.practice).length;
  const percent = progressPercent(state.progress, count);
  const remaining = Math.max(0, state.reviewItems.length - state.reviewIndex);
  $('#session-count').textContent = String(remaining);
  $('#best-quiz').textContent = state.progress.quizBest == null ? '—' : `${state.progress.quizBest}%`;
  $('#progress-value').textContent = `${percent}%`;
  $('.progress-track').setAttribute('aria-valuenow', String(percent));
  $('#progress-fill').style.width = `${percent}%`;
}

function renderObjectives() {
  $('#objectives').innerHTML = state.lesson.objectives.map(item => `<p class="objective">${escapeHtml(item)}</p>`).join('');
}

function renderVocabulary() {
  const query = normalizeText($('#phrase-search').value);
  const category = $('#category-filter').value || 'all';
  const categories = [...new Set(state.lesson.vocabulary.map(item => item.category))];
  const select = $('#category-filter');
  const current = categories.includes(category) ? category : 'all';
  select.innerHTML = `<option value="all">All topics</option>${categories.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}`;
  select.value = current;

  const filtered = state.lesson.vocabulary.filter(item => {
    const matchesCategory = current === 'all' || item.category === current;
    const haystack = normalizeText(`${item.tagalog} ${item.english} ${item.note || ''}`);
    return matchesCategory && (!query || haystack.includes(query));
  });
  $('#search-status').textContent = `${filtered.length} phrase${filtered.length === 1 ? '' : 's'} found.`;
  if (!filtered.length) { $('#lesson-groups').innerHTML = '<p class="empty-state">No phrases match that search.</p>'; return; }

  const familiar = new Set(state.progress.familiar);
  $('#lesson-groups').innerHTML = categories.map(cat => {
    const items = filtered.filter(item => item.category === cat);
    if (!items.length) return '';
    return `<section class="lesson-group"><h3>${escapeHtml(cat)}</h3><div class="vocab-grid">${items.map(item => `
      <article class="vocab-card">
        <div><strong lang="fil">${escapeHtml(item.tagalog)}</strong><span>${escapeHtml(item.english)}</span>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div>
        <div class="vocab-actions">
          <button type="button" class="icon-button" data-speak-id="${escapeHtml(item.id)}" aria-label="Hear ${escapeHtml(item.tagalog)}">▶</button>
          ${item.practice ? `<button type="button" class="icon-button ${familiar.has(item.id) ? 'is-active' : ''}" data-familiar-id="${escapeHtml(item.id)}" aria-pressed="${familiar.has(item.id)}" aria-label="${familiar.has(item.id) ? 'Remove familiar mark from' : 'Mark as familiar'} ${escapeHtml(item.tagalog)}">✓</button>` : ''}
        </div>
      </article>`).join('')}</div></section>`;
  }).join('');
}

function renderPatterns() {
  $('#grammar-notes').innerHTML = state.lesson.grammar_notes.map(note => `<article class="note-card"><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p></article>`).join('');
  $('#patterns').innerHTML = state.lesson.patterns.map(item => `<article class="pattern-card"><h3>${escapeHtml(item.title)}</h3><p class="tagalog" lang="fil">${escapeHtml(item.tagalog)}</p><p>${escapeHtml(item.english)}</p></article>`).join('');
}

function updateLessonButton() {
  const button = $('#mark-lesson');
  button.textContent = state.progress.lessonComplete ? 'Lesson done ✓' : 'Mark lesson done';
  button.classList.toggle('button-secondary', state.progress.lessonComplete);
  const next = nextLessonMeta();
  const nextButton = $('#next-lesson');
  nextButton.hidden = !next;
  nextButton.dataset.nextLessonId = next?.id || '';
  nextButton.textContent = next ? `Next: ${next.title}` : '';
}

function prepareReview() {
  state.reviewItems = dueItems(state.lesson.vocabulary, state.progress, 12);
  state.reviewIndex = 0;
  renderReview();
  updateDashboard();
}
function currentReviewItem() { return state.reviewItems[state.reviewIndex] || null; }
function renderReview() {
  const item = currentReviewItem();
  const total = state.reviewItems.length;
  $('#review-counter').textContent = `${Math.min(state.reviewIndex + 1, total)} / ${total}`;
  $('#review-answer').hidden = true;
  $('#review-ratings').hidden = true;
  $('#review-controls').hidden = !item;
  feedback($('#review-feedback'), '');
  if (!item) {
    $('#review-direction').textContent = 'Session complete';
    $('#review-prompt').textContent = 'Good work. Continue when you are ready.';
    $('#review-answer strong').textContent = '';
    $('#review-answer span').textContent = '';
    updateDashboard();
    return;
  }
  const reverse = state.reviewIndex % 2 === 1;
  $('#review-direction').textContent = reverse ? 'Tagalog → English' : 'English → Tagalog';
  $('#review-prompt').textContent = reverse ? item.tagalog : exerciseEnglish(item);
  $('#review-prompt').lang = reverse ? 'fil' : 'en';
  $('#review-answer strong').textContent = item.tagalog;
  $('#review-answer span').textContent = exerciseEnglish(item);
  updateDashboard();
}
function revealReview() { if (!currentReviewItem()) return; $('#review-answer').hidden = false; $('#review-ratings').hidden = false; $('#review-controls').hidden = true; $('.rating-button')?.focus(); }
function rateReview(rating) {
  const item = currentReviewItem();
  if (!item) return;
  state.progress.review[item.id] = scheduleReview(state.progress.review[item.id], rating);
  saveProgress();
  state.reviewIndex += 1;
  renderReview();
  const next = currentReviewItem();
  feedback($('#review-feedback'), next ? `${rating[0].toUpperCase()+rating.slice(1)} saved. Next phrase ready.` : 'Session complete.', 'success');
  $('#review-prompt').focus({preventScroll: true});
}

function shuffledPracticeItems() { return shuffle(state.lesson.vocabulary.filter(item => item.practice)); }
function prepareTyping() { state.typingItems = shuffledPracticeItems(); state.typingIndex = 0; renderTyping(); }
function currentTypingItem() { return state.typingItems[state.typingIndex] || null; }
function renderTyping() {
  const item = currentTypingItem();
  $('#typing-count').textContent = item ? `${state.typingIndex + 1} / ${state.typingItems.length}` : '';
  $('#typing-prompt').textContent = item ? exerciseEnglish(item) : 'No typing items available.';
  $('#typing-answer').value = '';
  feedback($('#typing-feedback'), '');
}
function checkTyping() {
  const item = currentTypingItem();
  if (!item) return;
  const answer = normalizeText($('#typing-answer').value);
  state.progress.typingAttempts += 1;
  if (item.accepted.includes(answer)) {
    if (!state.progress.typingCorrect.includes(item.id)) state.progress.typingCorrect.push(item.id);
    feedback($('#typing-feedback'), 'Correct.', 'success');
  } else {
    feedback($('#typing-feedback'), `Not yet. Compare with: ${item.tagalog}`, 'error');
  }
  saveProgress();
}
function nextTyping() { if (!state.typingItems.length) return; state.typingIndex = (state.typingIndex + 1) % state.typingItems.length; renderTyping(); $('#typing-answer').focus(); }

function prepareQuiz() { state.quiz = makeQuiz(state.lesson.vocabulary, 10); state.quizIndex = 0; state.quizScore = 0; state.quizAnswered = false; renderQuiz(); }
function currentQuiz() { return state.quiz[state.quizIndex] || null; }
function renderQuiz() {
  const question = currentQuiz();
  $('#quiz-result').hidden = true;
  $('#quiz-next').hidden = true;
  $('#quiz-submit').hidden = !question;
  feedback($('#quiz-feedback'), '');
  if (!question) { $('#quiz-question').textContent = 'No quiz available.'; $('#quiz-choices').innerHTML = ''; $('#quiz-progress').textContent = ''; return; }
  $('#quiz-progress').textContent = `Question ${state.quizIndex + 1} of ${state.quiz.length}`;
  $('#quiz-question').textContent = question.prompt;
  $('#quiz-choices').innerHTML = question.choices.map((choice,index) => `<label><input type="radio" name="quiz-choice" value="${index}"><span>${escapeHtml(choice)}</span></label>`).join('');
  state.quizAnswered = false;
}
function checkQuiz(event) {
  event.preventDefault();
  if (state.quizAnswered) return;
  const question = currentQuiz();
  const selected = $('input[name="quiz-choice"]:checked');
  if (!selected) { feedback($('#quiz-feedback'), 'Choose an answer first.', 'error'); return; }
  state.quizAnswered = true;
  const correct = Number(selected.value) === question.answer;
  if (correct) state.quizScore += 1;
  feedback($('#quiz-feedback'), `${correct ? 'Correct.' : 'Not yet.'} ${question.explanation}`, correct ? 'success' : 'error');
  $('#quiz-submit').hidden = true;
  $('#quiz-next').hidden = false;
  $('#quiz-next').textContent = state.quizIndex === state.quiz.length - 1 ? 'See result' : 'Next';
}
function nextQuiz() {
  if (!state.quizAnswered) return;
  if (state.quizIndex < state.quiz.length - 1) { state.quizIndex += 1; renderQuiz(); return; }
  const score = Math.round((state.quizScore / state.quiz.length) * 100);
  state.progress.quizBest = Math.max(state.progress.quizBest ?? 0, score);
  saveProgress();
  $('#quiz-result').hidden = false;
  $('#quiz-result').innerHTML = `<strong>${score}%</strong><p>${score >= 80 ? 'Strong result. Use the lesson in conversation next.' : 'Review the missed phrases and try again.'}</p><button id="quiz-restart" type="button" class="button button-secondary">Try again</button>`;
  $('#quiz-next').hidden = true;
  $('#quiz-restart').addEventListener('click', prepareQuiz, {once:true});
}

function findFilipinoVoice() {
  refreshVoices();
  return voiceCache.find(v => /^(fil|tl)(?:[-_]|$)/i.test(v.lang)) || voiceCache.find(v => /filipino|tagalog/i.test(v.name));
}
function speak(text, rate = .88) {
  if (!('speechSynthesis' in window)) { feedback($('#speech-status'), 'Speech playback is unavailable in this browser.', 'error'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text).replaceAll('____',''));
  utterance.lang = 'fil-PH'; utterance.rate = rate;
  const voice = findFilipinoVoice();
  if (voice) utterance.voice = voice;
  else if (!state.warnedVoice) {
    state.warnedVoice = true;
    showGlobalFeedback('No Filipino voice was found on this device. Playback may sound inaccurate.', 'error');
  }
  speechSynthesis.speak(utterance);
}
function renderSpeakOptions() {
  const items = state.lesson.vocabulary.filter(item => item.practice);
  $('#speak-phrase').innerHTML = items.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.tagalog)} — ${escapeHtml(item.english)}</option>`).join('');
  updateShadowPhrase();
}
function updateShadowPhrase() {
  const item = state.lesson.vocabulary.find(entry => entry.id === $('#speak-phrase').value) || state.lesson.vocabulary.find(entry => entry.practice);
  $('#shadow-tagalog').textContent = item?.tagalog || '';
  $('#shadow-english').textContent = item?.english || '';
}
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { feedback($('#record-status'), 'Recording is unavailable in this browser.', 'error'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    state.mediaChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.addEventListener('dataavailable', event => { if (event.data.size) state.mediaChunks.push(event.data); });
    state.mediaRecorder.addEventListener('stop', () => {
      if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
      state.recordingUrl = URL.createObjectURL(new Blob(state.mediaChunks,{type:state.mediaRecorder.mimeType || 'audio/webm'}));
      $('#recording-playback').src = state.recordingUrl; $('#recording-playback').hidden = false;
      stream.getTracks().forEach(track => track.stop());
      feedback($('#record-status'), 'Recording ready. Listen and compare.', 'success');
    });
    state.mediaRecorder.start();
    $('#record-start').disabled = true; $('#record-stop').disabled = false;
    feedback($('#record-status'), 'Recording…');
  } catch { feedback($('#record-status'), 'Microphone access was not granted.', 'error'); }
}
function stopRecording() { if (!state.mediaRecorder || state.mediaRecorder.state !== 'recording') return; state.mediaRecorder.stop(); $('#record-start').disabled = false; $('#record-stop').disabled = true; }

function renderBuilders() {
  $('#builder-grid').innerHTML = state.lesson.builders.map(builder => `<article class="builder-card" data-builder="${escapeHtml(builder.id)}"><h3>${escapeHtml(builder.title)}</h3><p>${escapeHtml(builder.description)}</p><div class="builder-fields">${builder.fields.map(field => `<label><span>${escapeHtml(field.label)}</span>${field.type === 'select' ? `<select data-builder-field="${escapeHtml(field.name)}">${field.options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}</select>` : `<input data-builder-field="${escapeHtml(field.name)}" type="text" placeholder="${escapeHtml(field.placeholder || '')}">`}</label>`).join('')}</div><div class="inline-actions"><button type="button" class="button button-secondary" data-generate-builder="${escapeHtml(builder.id)}">Build sentence</button><button type="button" class="button button-quiet" data-speak-builder="${escapeHtml(builder.id)}">Hear result</button></div><div class="result-card builder-output" lang="fil"></div></article>`).join('');
  state.lesson.builders.forEach(builder => generateBuilder(builder.id));
}
function generateBuilder(id) {
  const builder = state.lesson.builders.find(item => item.id === id);
  const card = $(`[data-builder="${CSS.escape(id)}"]`);
  if (!builder || !card) return '';
  let output = builder.template;
  builder.fields.forEach(field => {
    const input = $(`[data-builder-field="${CSS.escape(field.name)}"]`, card);
    const value = input.value.trim() || input.placeholder || `[${field.label}]`;
    output = output.replaceAll(`{{${field.name}}}`, value);
  });
  $('.builder-output', card).textContent = output;
  return output;
}

function renderMission() {
  const mission = state.lesson.mission;
  $('#mission-title').textContent = mission.title;
  $('#mission-description').textContent = mission.description;
  $('#mission-steps').innerHTML = mission.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('');
  $('#mission-example').textContent = mission.example;
  const button = $('#mark-mission');
  button.textContent = state.progress.missionComplete ? 'Challenge complete ✓' : 'Mark challenge complete';
  button.classList.toggle('button-secondary', state.progress.missionComplete);
}
function renderResources() {
  $('#resource-grid').innerHTML = state.lesson.resources.map(resource => `<article class="resource-card"><span class="resource-type">${escapeHtml(resource.type)}</span><h3>${escapeHtml(resource.title)}</h3><p>${escapeHtml(resource.description)}</p><a class="button button-secondary" href="${escapeHtml(resource.url)}">Open</a></article>`).join('');
}

function exportProgress() {
  const payload = {product:'Tagalog Academy',version:state.catalog.version,exportedAt:new Date().toISOString(),settings:settings(),progress:{}};
  for (const meta of state.catalog.lessons) {
    const lesson = state.lessons.get(meta.id);
    if (lesson) payload.progress[meta.id] = loadProgress(meta.id, lesson);
  }
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `tagalog-academy-progress-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  feedback($('#data-feedback'),'Backup exported.','success');
}
function validateRawProgress(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const checks = [
    ['lessonComplete', v => typeof v === 'boolean'], ['familiar', Array.isArray], ['review', v => v && typeof v === 'object' && !Array.isArray(v)],
    ['typingCorrect', Array.isArray], ['typingAttempts', v => Number.isInteger(v) && v >= 0], ['quizBest', v => v === null || (typeof v === 'number' && Number.isFinite(v))],
    ['missionComplete', v => typeof v === 'boolean'], ['missionChecks', v => v && typeof v === 'object' && !Array.isArray(v)], ['updatedAt', v => typeof v === 'string']
  ];
  return checks.every(([key,test]) => !(key in raw) || test(raw[key]));
}
async function importProgress(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || typeof payload !== 'object' || !payload.progress || typeof payload.progress !== 'object' || Array.isArray(payload.progress)) throw new Error('Invalid backup.');
    const candidate = new Map(); let recognized = 0;
    for (const meta of state.catalog.lessons) {
      if (!(meta.id in payload.progress)) continue;
      const raw = payload.progress[meta.id];
      if (!validateRawProgress(raw)) throw new Error(`Invalid data for ${meta.title}.`);
      const lesson = state.lessons.get(meta.id);
      candidate.set(meta.id, normalizeProgress(raw, allowedIds(lesson)));
      recognized += 1;
    }
    if (!recognized) throw new Error('No recognized lesson progress.');
    for (const [id, progress] of candidate) safeStorage.setItem(progressKey(id), JSON.stringify(progress));
    state.progress = loadProgress(state.lessonMeta.id, state.lesson);
    renderAll(); prepareReview(); prepareTyping(); prepareQuiz();
    feedback($('#data-feedback'),'Backup imported.','success');
  } catch {
    feedback($('#data-feedback'),'This backup is invalid. Nothing was changed.','error');
  }
}
function resetAllProgress() {
  if (!confirm('Reset all saved Tagalog Academy progress in this browser?')) return;
  for (const meta of state.catalog.lessons) safeStorage.removeItem(progressKey(meta.id));
  state.progress = defaultProgress();
  renderAll(); prepareReview(); prepareTyping(); prepareQuiz();
  feedback($('#data-feedback'),'All progress was reset.','success');
}

function openPanel(id, focus = true) {
  const tab = $(`.tab[data-panel="${CSS.escape(id)}"]`); const panel = $(`#${CSS.escape(id)}`);
  if (!tab || !panel) return;
  $$('.tab').forEach(item => { const active = item === tab; item.classList.toggle('is-active',active); item.setAttribute('aria-selected',String(active)); item.tabIndex = active ? 0 : -1; });
  $$('.panel').forEach(item => { const active = item === panel; item.hidden = !active; item.classList.toggle('is-active',active); });
  if (focus) panel.focus({preventScroll:true});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headerHeight = $('.site-header')?.getBoundingClientRect().height || 0;
  const top = $('.tab-list').getBoundingClientRect().top + scrollY - headerHeight - 10;
  scrollTo({top:Math.max(0,top),behavior:reduced ? 'auto' : 'smooth'});
}

function applyThemeLabel() {
  const preference = document.documentElement.dataset.themePreference || 'system';
  const label = preference[0].toUpperCase()+preference.slice(1);
  $('#theme-toggle').textContent = label;
  $('#theme-toggle').setAttribute('aria-label', `Appearance: ${label}. Activate to change.`);
}
function cycleTheme() {
  const current = document.documentElement.dataset.themePreference || 'system';
  const next = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
  saveSettings({theme:next});
  document.documentElement.dataset.themePreference = next;
  document.documentElement.dataset.theme = next === 'dark' || (next === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  applyThemeLabel();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const register = () => navigator.serviceWorker.register('service-worker.js').catch(error => console.warn('Service worker registration failed',error));
  if (document.readyState === 'complete') register(); else addEventListener('load',register,{once:true});
}

function bindEvents() {
  $('#lesson-select').addEventListener('change', event => loadLesson(event.target.value));
  $('#continue-learning').addEventListener('click', continueLearning);
  $('#retry-load').addEventListener('click', () => state.failedLessonId && loadLesson(state.failedLessonId));
  $('#phrase-search').addEventListener('input', renderVocabulary);
  $('#category-filter').addEventListener('change', renderVocabulary);
  $('#mark-lesson').addEventListener('click', () => { state.progress.lessonComplete = !state.progress.lessonComplete; saveProgress(); updateLessonButton(); });
  $('#next-lesson').addEventListener('click', event => { const id = event.currentTarget.dataset.nextLessonId; if (id) loadLesson(id); });

  document.addEventListener('click', event => {
    const lesson = event.target.closest('[data-lesson-id]'); if (lesson) loadLesson(lesson.dataset.lessonId);
    const scroll = event.target.closest('[data-scroll-to]'); if (scroll) document.getElementById(scroll.dataset.scrollTo)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    const tab = event.target.closest('.tab[data-panel]'); if (tab) openPanel(tab.dataset.panel);
    const speaker = event.target.closest('[data-speak-id]'); if (speaker) { const item = state.lesson.vocabulary.find(entry => entry.id === speaker.dataset.speakId); if (item) speak(item.tagalog); }
    const familiar = event.target.closest('[data-familiar-id]'); if (familiar) {
      const id = familiar.dataset.familiarId;
      const set = new Set(state.progress.familiar);
      set.has(id) ? set.delete(id) : set.add(id);
      state.progress.familiar = [...set];
      saveProgress();
      const active = set.has(id);
      const item = state.lesson.vocabulary.find(entry => entry.id === id);
      familiar.classList.toggle('is-active', active);
      familiar.setAttribute('aria-pressed', String(active));
      familiar.setAttribute('aria-label', `${active ? 'Remove familiar mark from' : 'Mark as familiar'} ${item?.tagalog || 'phrase'}`);
    }
    const generate = event.target.closest('[data-generate-builder]'); if (generate) generateBuilder(generate.dataset.generateBuilder);
    const speakBuilder = event.target.closest('[data-speak-builder]'); if (speakBuilder) speak(generateBuilder(speakBuilder.dataset.speakBuilder));
  });

  $('.tab-list').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const tabs=$$('.tab'); const current=tabs.indexOf(document.activeElement); let next=current;
    if (event.key==='ArrowRight') next=(current+1)%tabs.length; if (event.key==='ArrowLeft') next=(current-1+tabs.length)%tabs.length; if (event.key==='Home') next=0; if (event.key==='End') next=tabs.length-1;
    tabs[next].focus(); openPanel(tabs[next].dataset.panel,false);
  });
  document.addEventListener('change', event => { if (event.target.matches('[data-builder-field]')) { const card=event.target.closest('[data-builder]'); if (card) generateBuilder(card.dataset.builder); } });

  $('#review-reveal').addEventListener('click', revealReview);
  $('#review-speak').addEventListener('click', () => { const item=currentReviewItem(); if (item) speak(item.tagalog); });
  $$('.rating-button').forEach(button => button.addEventListener('click',()=>rateReview(button.dataset.rating)));
  $('#typing-check').addEventListener('click',checkTyping); $('#typing-reveal').addEventListener('click',()=>{const item=currentTypingItem(); if(item) feedback($('#typing-feedback'),item.tagalog,'success');}); $('#typing-next').addEventListener('click',nextTyping); $('#typing-answer').addEventListener('keydown',event=>{if(event.key==='Enter')checkTyping();});
  $('#quiz-form').addEventListener('submit',checkQuiz); $('#quiz-next').addEventListener('click',nextQuiz);
  $('#speak-phrase').addEventListener('change',updateShadowPhrase); $('#speak-normal').addEventListener('click',()=>speak($('#shadow-tagalog').textContent,.88)); $('#speak-slow').addEventListener('click',()=>speak($('#shadow-tagalog').textContent,.68));
  $('#record-start').addEventListener('click',startRecording); $('#record-stop').addEventListener('click',stopRecording);
  $('#mark-mission').addEventListener('click',()=>{state.progress.missionComplete=!state.progress.missionComplete;saveProgress();renderMission();});
  $('#export-progress').addEventListener('click',exportProgress); $('#import-progress').addEventListener('change',event=>{const[file]=event.target.files;if(file)importProgress(file);event.target.value='';}); $('#reset-all').addEventListener('click',resetAllProgress);
  $('#theme-toggle').addEventListener('click',cycleTheme);
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.deferredPrompt=event;$('#install-app').hidden=false;});
  $('#install-app').addEventListener('click',async()=>{if(!state.deferredPrompt)return;state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;$('#install-app').hidden=true;});
}

init();
