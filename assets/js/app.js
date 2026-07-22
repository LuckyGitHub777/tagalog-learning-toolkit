(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const STORAGE_PREFIX = 'tagalog-academy.progress.';
  const SETTINGS_KEY = 'tagalog-academy.settings';

  const memoryStore = new Map();
  const safeStorage = {
    getItem(key) {
      try { return window.localStorage.getItem(key); }
      catch { return memoryStore.has(key) ? memoryStore.get(key) : null; }
    },
    setItem(key, value) {
      try { window.localStorage.setItem(key, value); }
      catch { memoryStore.set(key, String(value)); }
    },
    removeItem(key) {
      try { window.localStorage.removeItem(key); }
      catch { memoryStore.delete(key); }
    }
  };

  const state = {
    course: null,
    lesson: null,
    week: null,
    progress: null,
    reviewItems: [],
    reviewIndex: 0,
    typingItems: [],
    typingIndex: 0,
    quizOrder: [],
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,
    deferredPrompt: null,
    mediaRecorder: null,
    mediaChunks: [],
    recordingUrl: null
  };

  let voiceCache = [];

  function refreshVoices() {
    voiceCache = window.speechSynthesis?.getVoices?.() || [];
  }

  if ('speechSynthesis' in window) {
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalize(value) {
    return String(value ?? '')
      .toLocaleLowerCase('fil-PH')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[“”‘’'"!?.,;:()[\]{}]/g, '')
      .replace(/[-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function todayMs() {
    return Date.now();
  }

  function defaultProgress() {
    return {
      lessonComplete: false,
      familiar: [],
      review: {},
      typingCorrect: [],
      quizBest: null,
      missionComplete: false,
      missionChecks: {},
      updatedAt: new Date().toISOString()
    };
  }

  function loadSettings() {
    try {
      return JSON.parse(safeStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSettings(patch) {
    const settings = {...loadSettings(), ...patch};
    safeStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function progressKey(weekId) {
    return `${STORAGE_PREFIX}${weekId}`;
  }

  function loadProgress(weekId) {
    try {
      const parsed = JSON.parse(safeStorage.getItem(progressKey(weekId)));
      return {...defaultProgress(), ...(parsed || {})};
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    if (!state.week || !state.progress) return;
    state.progress.updatedAt = new Date().toISOString();
    safeStorage.setItem(progressKey(state.week.id), JSON.stringify(state.progress));
    updateDashboard();
    renderRoadmap();
  }

  async function getJson(url) {
    const response = await fetch(url, {cache: 'no-store'});
    if (!response.ok) throw new Error(`Could not load ${url}`);
    return response.json();
  }

  async function init() {
    bindGlobalEvents();
    applySavedTheme();

    try {
      state.course = await getJson('data/course.json');
      populateWeekSelect();
      renderRoadmap();

      const settings = loadSettings();
      const selected = state.course.weeks.find(
        week => week.id === settings.currentWeek && week.status === 'available'
      ) || state.course.weeks.find(week => week.status === 'available');

      await loadWeek(selected.id);
      registerServiceWorker();
    } catch (error) {
      console.error(error);
      $('#dashboard-status').textContent = 'Course could not load';
      $('#lesson-groups').innerHTML = `<p class="empty-state">The course files could not be loaded. Serve the project through GitHub Pages or a local web server instead of opening index.html directly.</p>`;
    }
  }

  function populateWeekSelect() {
    const select = $('#week-select');
    select.innerHTML = state.course.weeks.map(week => {
      const suffix = week.status === 'available' ? '' : ' — planned';
      return `<option value="${escapeHtml(week.id)}" ${week.status !== 'available' ? 'disabled' : ''}>Week ${week.number}: ${escapeHtml(week.title)}${suffix}</option>`;
    }).join('');
  }

  async function loadWeek(weekId) {
    const week = state.course.weeks.find(item => item.id === weekId);
    if (!week || week.status !== 'available') return;

    state.week = week;
    state.lesson = await getJson(week.file);
    state.progress = loadProgress(week.id);
    state.reviewIndex = 0;
    state.typingIndex = 0;
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    saveSettings({currentWeek: week.id});

    $('#week-select').value = week.id;
    renderAll();
    prepareReview();
    prepareTyping();
    prepareQuiz();
  }

  function renderAll() {
    $('#week-eyebrow').textContent = `Week ${state.lesson.week} · ${state.lesson.short_title}`;
    $('#hero-title').textContent = state.lesson.short_title;
    $('#hero-copy').textContent = state.lesson.subtitle;
    $('#lesson-title').textContent = state.lesson.title;
    $('#lesson-subtitle').textContent = state.lesson.subtitle;
    $('#content-status').textContent = state.lesson.source_status || state.lesson.content_status || '';

    renderRoadmap();
    renderObjectives();
    renderCategoryFilter();
    renderVocabulary();
    renderGrammar();
    renderPatterns();
    renderSpeakOptions();
    renderBuilders();
    renderMissions();
    renderResources();
    updateLessonButton();
    updateMissionButton();
    updateDashboard();
  }

  function progressPercent(progress = state.progress, lesson = state.lesson) {
    if (!progress || !lesson) return 0;

    const familiarRatio = lesson.vocabulary.length
      ? progress.familiar.length / lesson.vocabulary.length
      : 0;

    const typingItems = lesson.vocabulary.filter(item => (item.accepted || []).length);
    const typingRatio = typingItems.length
      ? progress.typingCorrect.length / typingItems.length
      : 0;

    const reviewMastered = lesson.vocabulary.filter(item => (progress.review[item.id]?.level || 0) >= 3).length;
    const reviewRatio = lesson.vocabulary.length ? reviewMastered / lesson.vocabulary.length : 0;
    const quizRatio = progress.quizBest == null ? 0 : progress.quizBest / 100;

    const score =
      familiarRatio * 25 +
      typingRatio * 15 +
      reviewRatio * 20 +
      quizRatio * 20 +
      (progress.lessonComplete ? 10 : 0) +
      (progress.missionComplete ? 10 : 0);

    return Math.min(100, Math.round(score));
  }

  function masteryPercent() {
    const familiar = new Set(state.progress.familiar);
    let total = 0;
    state.lesson.vocabulary.forEach(item => {
      const level = state.progress.review[item.id]?.level || 0;
      total += Math.max(familiar.has(item.id) ? 1 : 0, Math.min(level / 3, 1));
    });
    return state.lesson.vocabulary.length
      ? Math.round((total / state.lesson.vocabulary.length) * 100)
      : 0;
  }

  function dueItems() {
    const now = todayMs();
    return state.lesson.vocabulary.filter(item => {
      const record = state.progress.review[item.id];
      return !record || !record.due || record.due <= now;
    });
  }

  function updateDashboard() {
    if (!state.lesson || !state.progress) return;

    const progress = progressPercent();
    const mastery = masteryPercent();
    const due = dueItems().length;

    $('#due-count').textContent = String(due);
    $('#mastery-count').textContent = `${mastery}%`;
    $('#best-quiz').textContent = state.progress.quizBest == null ? '—' : `${state.progress.quizBest}%`;
    $('#progress-label').textContent = `${progress}% week progress`;
    $('#known-count').textContent = `${state.progress.familiar.length} familiar`;
    $('#progress-fill').style.width = `${progress}%`;
    $('.progress-track').setAttribute('aria-valuenow', String(progress));

    if (progress >= 80) {
      $('#dashboard-status').textContent = 'Mastery threshold reached';
    } else if (state.progress.lessonComplete) {
      $('#dashboard-status').textContent = 'Lesson complete — keep practicing';
    } else {
      $('#dashboard-status').textContent = `Week ${state.lesson.week} in progress`;
    }
  }

  function renderRoadmap() {
    if (!state.course) return;
    const container = $('#course-roadmap');
    container.innerHTML = state.course.weeks.map(week => {
      const available = week.status === 'available';
      const active = state.week?.id === week.id;
      const displayProgress = available ? weekProgressFromStorage(week.id) : 0;
      return `
        <article class="roadmap-card ${active ? 'is-active' : ''} ${available ? '' : 'is-planned'}" data-week-card="${escapeHtml(week.id)}" ${available ? 'tabindex="0" role="button"' : ''}>
          <div class="roadmap-meta"><span>Week ${week.number}</span><span>${available ? `${displayProgress}%` : 'Planned'}</span></div>
          <strong>${escapeHtml(week.title)}</strong>
          <span>${escapeHtml(week.summary)}</span>
        </article>`;
    }).join('');
  }

  function weekProgressFromStorage(weekId) {
    const week = state.course.weeks.find(item => item.id === weekId);
    if (!week || week.status !== 'available') return 0;
    const progress = loadProgress(weekId);
    if (state.lesson?.id === weekId) return progressPercent(progress, state.lesson);

    const rough =
      (progress.lessonComplete ? 20 : 0) +
      (progress.missionComplete ? 20 : 0) +
      (progress.quizBest == null ? 0 : Math.round(progress.quizBest * .4)) +
      Math.min(progress.familiar.length * 2, 20);
    return Math.min(100, rough);
  }

  function renderObjectives() {
    $('#learning-objectives').innerHTML = state.lesson.objectives
      .map(item => `<div class="objective-card">${escapeHtml(item)}</div>`)
      .join('');
  }

  function categories() {
    return [...new Set(state.lesson.vocabulary.map(item => item.category))];
  }

  function renderCategoryFilter() {
    const select = $('#category-filter');
    select.innerHTML = `<option value="all">All categories</option>` +
      categories().map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  function renderVocabulary() {
    const search = normalize($('#phrase-search').value);
    const category = $('#category-filter').value;
    const familiar = new Set(state.progress.familiar);

    const filtered = state.lesson.vocabulary.filter(item => {
      const matchesCategory = category === 'all' || item.category === category;
      const haystack = normalize(`${item.tagalog} ${item.english} ${item.note || ''}`);
      return matchesCategory && (!search || haystack.includes(search));
    });

    const grouped = new Map();
    filtered.forEach(item => {
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category).push(item);
    });

    if (!filtered.length) {
      $('#lesson-groups').innerHTML = `<p class="empty-state">No phrases match this search.</p>`;
      return;
    }

    $('#lesson-groups').innerHTML = [...grouped.entries()].map(([categoryName, items]) => `
      <section class="lesson-group">
        <h3>${escapeHtml(categoryName)}</h3>
        ${items.map(item => `
          <div class="phrase-row">
            <div>
              <strong lang="fil">${escapeHtml(item.tagalog)}</strong>
              ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
            </div>
            <div class="phrase-english">${escapeHtml(item.english)}</div>
            <button class="icon-button" type="button" data-speak-id="${escapeHtml(item.id)}" aria-label="Hear ${escapeHtml(item.tagalog)}">🔊</button>
            <button class="icon-button ${familiar.has(item.id) ? 'is-familiar' : ''}" type="button" data-familiar-id="${escapeHtml(item.id)}" aria-pressed="${familiar.has(item.id)}" aria-label="Mark ${escapeHtml(item.tagalog)} as familiar">✓</button>
          </div>`).join('')}
      </section>`).join('');
  }

  function renderGrammar() {
    $('#grammar-notes').innerHTML = (state.lesson.grammar_notes || []).map(note => `
      <article class="grammar-card">
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(note.body)}</p>
        <ul class="example-list">
          ${(note.examples || []).map(example => `
            <li><strong lang="fil">${escapeHtml(example.tagalog)}</strong><span>${escapeHtml(example.english)}</span></li>
          `).join('')}
        </ul>
      </article>`).join('');
  }

  function renderPatterns() {
    $('#sentence-patterns').innerHTML = (state.lesson.sentence_patterns || []).map(pattern => `
      <article class="pattern-card">
        <strong>${escapeHtml(pattern.title)}</strong>
        <code lang="fil">${escapeHtml(pattern.pattern)}</code>
        <p>${escapeHtml(pattern.english)}</p>
      </article>`).join('');
  }

  function updateLessonButton() {
    const button = $('#mark-lesson');
    button.textContent = state.progress.lessonComplete ? 'Lesson complete ✓' : 'Mark lesson complete';
    button.classList.toggle('button-secondary', state.progress.lessonComplete);
  }

  function findFilipinoVoice() {
    return voiceCache.find(voice => /^(fil|tl)(?:[-_]|$)/i.test(voice.lang))
      || voiceCache.find(voice => /filipino|tagalog/i.test(voice.name));
  }

  function showGlobalFeedback(message, type = 'error') {
    const feedback = $('#app-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `global-feedback ${type}`.trim();
    feedback.hidden = false;
    window.clearTimeout(showGlobalFeedback.timeoutId);
    showGlobalFeedback.timeoutId = window.setTimeout(() => {
      feedback.hidden = true;
    }, 9000);
  }

  function speak(text, rate = .88) {
    if (!('speechSynthesis' in window)) {
      const message = 'Speech playback is not supported in this browser.';
      showFeedback($('#record-status'), message, 'error');
      showGlobalFeedback(message);
      return;
    }

    refreshVoices();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replaceAll('____', ''));
    utterance.lang = 'fil-PH';
    utterance.rate = rate;

    const filipino = findFilipinoVoice();
    if (filipino) {
      utterance.voice = filipino;
    } else {
      const warning = 'No Filipino voice is installed on this device. Playback may sound inaccurate; use it only as a memory cue, not as a pronunciation model.';
      showFeedback($('#record-status'), warning, 'error');
      showGlobalFeedback(warning);
    }

    window.speechSynthesis.speak(utterance);
  }

  function reviewEligible() {
    return state.lesson.vocabulary.filter(item =>
      item.tagalog &&
      !item.tagalog.includes('____') &&
      !item.tagalog.includes('{{')
    );
  }

  function prepareReview() {
    const now = todayMs();
    state.reviewItems = reviewEligible()
      .map(item => ({item, record: state.progress.review[item.id] || {level: 0, due: 0}}))
      .sort((a, b) => {
        const aDue = a.record.due || 0;
        const bDue = b.record.due || 0;
        const aIsDue = aDue <= now ? 0 : 1;
        const bIsDue = bDue <= now ? 0 : 1;
        return aIsDue - bIsDue || a.record.level - b.record.level || aDue - bDue;
      })
      .slice(0, 12)
      .map(entry => entry.item);

    state.reviewIndex = 0;
    renderReview();
  }

  function currentReviewItem() {
    return state.reviewItems[state.reviewIndex] || null;
  }

  function renderReview() {
    const item = currentReviewItem();
    const answer = $('#review-answer');
    const ratings = $('#review-ratings');

    answer.hidden = true;
    ratings.hidden = true;
    $('#review-reveal').hidden = false;
    $('#review-feedback').textContent = '';

    if (!item) {
      $('#review-counter').textContent = '0 / 0';
      $('#review-prompt').textContent = 'No review items are available.';
      $('#review-speak').disabled = true;
      return;
    }

    $('#review-speak').disabled = false;
    $('#review-counter').textContent = `${state.reviewIndex + 1} / ${state.reviewItems.length}`;
    $('#review-direction').textContent = 'English → Tagalog';
    $('#review-prompt').textContent = item.english;
    $('strong', answer).textContent = item.tagalog;
    $('span', answer).textContent = item.note || item.english;
  }

  function revealReview() {
    if (!currentReviewItem()) return;
    $('#review-answer').hidden = false;
    $('#review-ratings').hidden = false;
    $('#review-reveal').hidden = true;
  }

  function rateReview(rating) {
    const item = currentReviewItem();
    if (!item) return;

    const existing = state.progress.review[item.id] || {level: 0, due: 0};
    let level = existing.level || 0;
    let due = todayMs();

    if (rating === 'again') {
      level = Math.max(0, level - 1);
      due += 10 * 60 * 1000;
    } else if (rating === 'hard') {
      level = Math.max(1, level);
      due += 24 * 60 * 60 * 1000;
    } else {
      level += 1;
      const intervals = [1, 2, 4, 8, 16, 30, 60];
      const days = intervals[Math.min(level - 1, intervals.length - 1)];
      due += days * 24 * 60 * 60 * 1000;
    }

    state.progress.review[item.id] = {level, due, lastRating: rating};
    saveProgress();

    state.reviewIndex += 1;
    if (state.reviewIndex >= state.reviewItems.length) {
      $('#review-prompt').textContent = 'Session complete. Return later to strengthen retention.';
      $('#review-counter').textContent = `${state.reviewItems.length} / ${state.reviewItems.length}`;
      $('#review-answer').hidden = true;
      $('#review-ratings').hidden = true;
      $('#review-reveal').hidden = true;
      $('#review-speak').disabled = true;
      showFeedback($('#review-feedback'), 'Review session complete.', 'success');
      return;
    }
    renderReview();
  }

  function typingEligible() {
    return state.lesson.vocabulary.filter(item =>
      Array.isArray(item.accepted) &&
      item.accepted.length &&
      !item.tagalog.includes('____')
    );
  }

  function shuffledIndexes(length) {
    const values = Array.from({length}, (_, index) => index);
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function prepareTyping() {
    const eligible = typingEligible();
    const order = shuffledIndexes(eligible.length);
    state.typingItems = order.map(index => eligible[index]);
    state.typingIndex = 0;
    renderTyping();
  }

  function currentTypingItem() {
    return state.typingItems[state.typingIndex] || null;
  }

  function renderTyping() {
    const item = currentTypingItem();
    if (!item) {
      $('#typing-prompt').textContent = 'No typing prompts are available.';
      $('#typing-count').textContent = '';
      return;
    }
    $('#typing-prompt').textContent = item.english;
    $('#typing-count').textContent = `${state.typingIndex + 1} / ${state.typingItems.length}`;
    $('#typing-answer').value = '';
    $('#typing-feedback').textContent = '';
    $('#typing-feedback').className = 'feedback';
  }

  function checkTyping() {
    const item = currentTypingItem();
    if (!item) return;
    const answer = normalize($('#typing-answer').value);
    const accepted = item.accepted.map(normalize);
    const feedback = $('#typing-feedback');

    if (!answer) {
      showFeedback(feedback, 'Type an answer first.', 'error');
      return;
    }

    if (accepted.includes(answer)) {
      showFeedback(feedback, `Correct: ${item.tagalog}`, 'success');
      if (!state.progress.typingCorrect.includes(item.id)) {
        state.progress.typingCorrect.push(item.id);
        saveProgress();
      }
    } else {
      showFeedback(feedback, `Not yet. Compare your answer with: ${item.tagalog}`, 'error');
    }
  }

  function nextTyping() {
    if (!state.typingItems.length) return;
    state.typingIndex = (state.typingIndex + 1) % state.typingItems.length;
    renderTyping();
  }

  function prepareQuiz() {
    state.quizOrder = shuffledIndexes(state.lesson.quiz.length);
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    $('#quiz-form').hidden = false;
    $('#quiz-result').hidden = true;
    renderQuiz();
  }

  function currentQuizItem() {
    return state.lesson.quiz[state.quizOrder[state.quizIndex]];
  }

  function renderQuiz() {
    const item = currentQuizItem();
    $('#quiz-progress').textContent = `Question ${state.quizIndex + 1} of ${state.lesson.quiz.length}`;
    $('#quiz-question').textContent = item.question;
    $('#quiz-choices').innerHTML = item.choices.map((choice, index) => `
      <label class="choice">
        <input type="radio" name="quiz-choice" value="${index}">
        <span>${escapeHtml(choice)}</span>
      </label>`).join('');
    $('#quiz-feedback').textContent = '';
    $('#quiz-feedback').className = 'feedback';
    $('#quiz-submit').hidden = false;
    $('#quiz-next').hidden = true;
    state.quizAnswered = false;
  }

  function checkQuiz(event) {
    event.preventDefault();
    if (state.quizAnswered) return;

    const selected = $('input[name="quiz-choice"]:checked');
    if (!selected) {
      showFeedback($('#quiz-feedback'), 'Choose an answer.', 'error');
      return;
    }

    const item = currentQuizItem();
    const selectedIndex = Number(selected.value);
    const correct = selectedIndex === item.answer;
    if (correct) state.quizScore += 1;

    showFeedback(
      $('#quiz-feedback'),
      `${correct ? 'Correct.' : `The answer is ${item.choices[item.answer]}.`} ${item.explanation}`,
      correct ? 'success' : 'error'
    );

    state.quizAnswered = true;
    $('#quiz-submit').hidden = true;
    $('#quiz-next').hidden = false;
    $('#quiz-next').textContent = state.quizIndex === state.lesson.quiz.length - 1 ? 'See result' : 'Next question';
  }

  function nextQuiz() {
    if (!state.quizAnswered) return;
    if (state.quizIndex < state.lesson.quiz.length - 1) {
      state.quizIndex += 1;
      renderQuiz();
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    const percent = Math.round((state.quizScore / state.lesson.quiz.length) * 100);
    state.progress.quizBest = Math.max(state.progress.quizBest || 0, percent);
    saveProgress();

    $('#quiz-form').hidden = true;
    const result = $('#quiz-result');
    result.hidden = false;
    result.innerHTML = `
      <h3>${percent}%</h3>
      <p>You answered ${state.quizScore} of ${state.lesson.quiz.length} correctly.</p>
      <p>${percent >= 80 ? 'Mastery threshold reached for this quiz.' : 'Review the weak phrases and try again.'}</p>
      <button id="quiz-restart" class="button button-secondary" type="button">Try again</button>`;
    $('#quiz-restart').addEventListener('click', prepareQuiz);
  }

  function renderSpeakOptions() {
    const eligible = reviewEligible();
    $('#speak-phrase').innerHTML = eligible.map(item =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.tagalog)} — ${escapeHtml(item.english)}</option>`
    ).join('');
    updateShadowPhrase();
  }

  function updateShadowPhrase() {
    const item = state.lesson.vocabulary.find(entry => entry.id === $('#speak-phrase').value) || reviewEligible()[0];
    if (!item) return;
    $('#shadow-tagalog').textContent = item.tagalog;
    $('#shadow-english').textContent = item.english;
  }

  async function startRecording() {
    const status = $('#record-status');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showFeedback(status, 'Microphone recording is not supported in this browser.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      state.mediaChunks = [];
      state.mediaRecorder = new MediaRecorder(stream);
      state.mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data.size) state.mediaChunks.push(event.data);
      });
      state.mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(state.mediaChunks, {type: state.mediaRecorder.mimeType || 'audio/webm'});
        if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
        state.recordingUrl = URL.createObjectURL(blob);
        const audio = $('#record-playback');
        audio.src = state.recordingUrl;
        audio.hidden = false;
        stream.getTracks().forEach(track => track.stop());
        showFeedback(status, 'Recording ready. Compare it with the reference phrase.', 'success');
      });
      state.mediaRecorder.start();
      $('#record-start').hidden = true;
      $('#record-stop').hidden = false;
      showFeedback(status, 'Recording…', 'success');
    } catch {
      showFeedback(status, 'Microphone permission was not granted.', 'error');
    }
  }

  function stopRecording() {
    if (state.mediaRecorder?.state === 'recording') {
      state.mediaRecorder.stop();
    }
    $('#record-start').hidden = false;
    $('#record-stop').hidden = true;
  }

  function renderBuilders() {
    $('#builder-grid').innerHTML = (state.lesson.builders || []).map(builder => `
      <article class="builder-card" data-builder="${escapeHtml(builder.id)}">
        <div>
          <p class="eyebrow">Sentence builder</p>
          <h3>${escapeHtml(builder.title)}</h3>
          <p class="helper">${escapeHtml(builder.description)}</p>
        </div>
        <div class="builder-fields">
          ${builder.fields.map(field => renderBuilderField(field)).join('')}
        </div>
        ${builder.note ? `<p class="helper">${escapeHtml(builder.note)}</p>` : ''}
        <button class="button button-secondary" type="button" data-generate-builder="${escapeHtml(builder.id)}">Generate</button>
        <label for="builder-output-${escapeHtml(builder.id)}">Your Tagalog</label>
        <textarea id="builder-output-${escapeHtml(builder.id)}" class="output-textarea" readonly></textarea>
      </article>`).join('');

    (state.lesson.builders || []).forEach(builder => generateBuilder(builder.id));
  }

  function renderBuilderField(field) {
    const id = `builder-field-${field.name}-${Math.random().toString(36).slice(2, 7)}`;
    if (field.type === 'select') {
      return `
        <label class="builder-field" for="${id}">
          <span>${escapeHtml(field.label)}</span>
          <select id="${id}" data-builder-field="${escapeHtml(field.name)}">
            ${field.options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>`;
    }
    return `
      <label class="builder-field" for="${id}">
        <span>${escapeHtml(field.label)}</span>
        <input id="${id}" data-builder-field="${escapeHtml(field.name)}" type="text" placeholder="${escapeHtml(field.placeholder || '')}">
      </label>`;
  }

  function generateBuilder(builderId) {
    const builder = state.lesson.builders.find(item => item.id === builderId);
    const card = $(`[data-builder="${CSS.escape(builderId)}"]`);
    if (!builder || !card) return;

    const values = {};
    $$('[data-builder-field]', card).forEach(input => {
      values[input.dataset.builderField] = input.value.trim() || input.placeholder || '';
    });

    let output = builder.template;
    Object.entries(values).forEach(([key, value]) => {
      output = output.replaceAll(`{{${key}}}`, value);
    });

    $(`#builder-output-${CSS.escape(builderId)}`).value = output;
  }

  function renderMissions() {
    const checks = state.progress.missionChecks || {};
    $('#mission-grid').innerHTML = (state.lesson.missions || []).map((mission, index) => `
      <article class="mission-card">
        <p class="eyebrow">Option ${index + 1}</p>
        <h3>${escapeHtml(mission.title)}</h3>
        <p>${escapeHtml(mission.description)}</p>
        <ol>${mission.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        <p class="mission-example"><strong>Example:</strong> <span lang="fil">${escapeHtml(mission.example)}</span></p>
        <label class="mission-check">
          <input type="checkbox" data-mission-check="${index}" ${checks[index] ? 'checked' : ''}>
          <span>I completed or rehearsed this mission.</span>
        </label>
      </article>`).join('');
  }

  function updateMissionButton() {
    const button = $('#mark-mission');
    button.textContent = state.progress.missionComplete ? 'Mission complete ✓' : 'Mark mission complete';
    button.classList.toggle('button-secondary', state.progress.missionComplete);
  }

  function renderResources() {
    const resources = state.lesson.resources || [];
    if (!resources.length) {
      $('#resource-grid').innerHTML = `<p class="empty-state">No external resources are required for this week.</p>`;
      return;
    }

    $('#resource-grid').innerHTML = resources.map(resource => {
      const external = /^https?:\/\//i.test(resource.url);
      return `
        <article class="resource-card">
          <span class="resource-type">${escapeHtml(resource.type)}</span>
          <h3>${escapeHtml(resource.title)}</h3>
          <p>${escapeHtml(resource.description)}</p>
          <a class="button button-secondary" href="${escapeHtml(resource.url)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}>Open resource</a>
        </article>`;
    }).join('');
  }

  function openPanel(panelId, focus = true) {
    const tab = $(`[data-panel="${CSS.escape(panelId)}"]`);
    const panel = $(`#${CSS.escape(panelId)}`);
    if (!tab || !panel) return;

    $$('.tab').forEach(item => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    });

    $$('.panel').forEach(item => {
      const active = item === panel;
      item.hidden = !active;
      item.classList.toggle('is-active', active);
    });

    if (focus) panel.focus({preventScroll: true});
    const headerHeight = $('.site-header')?.getBoundingClientRect().height || 0;
    const tabList = $('.tab-list');
    const tabTop = tabList.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({top: Math.max(0, tabTop - headerHeight - 12), behavior: 'smooth'});
  }

  function showFeedback(element, message, type = '') {
    element.textContent = message;
    element.className = `feedback ${type}`.trim();
  }

  function exportProgress() {
    const payload = {
      product: 'Tagalog Academy',
      version: state.course.version,
      exportedAt: new Date().toISOString(),
      settings: loadSettings(),
      progress: {}
    };

    state.course.weeks.filter(week => week.status === 'available').forEach(week => {
      payload.progress[week.id] = loadProgress(week.id);
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tagalog-academy-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showFeedback($('#data-feedback'), 'Progress exported.', 'success');
  }

  async function importProgress(file) {
    try {
      const payload = JSON.parse(await file.text());
      if (!payload.progress || typeof payload.progress !== 'object') throw new Error('Invalid progress file.');

      Object.entries(payload.progress).forEach(([weekId, progress]) => {
        if (state.course.weeks.some(week => week.id === weekId)) {
          safeStorage.setItem(progressKey(weekId), JSON.stringify({...defaultProgress(), ...progress}));
        }
      });

      state.progress = loadProgress(state.week.id);
      renderAll();
      prepareReview();
      prepareTyping();
      prepareQuiz();
      showFeedback($('#data-feedback'), 'Progress imported.', 'success');
    } catch {
      showFeedback($('#data-feedback'), 'This file could not be imported.', 'error');
    }
  }

  function resetCurrentWeek() {
    if (!confirm(`Reset all saved progress for Week ${state.lesson.week}?`)) return;
    safeStorage.removeItem(progressKey(state.week.id));
    state.progress = defaultProgress();
    renderAll();
    prepareReview();
    prepareTyping();
    prepareQuiz();
    showFeedback($('#data-feedback'), 'This week was reset.', 'success');
  }

  function applySavedTheme() {
    const theme = loadSettings().theme || 'light';
    document.documentElement.dataset.theme = theme;
    $('#theme-toggle').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    $('#theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    saveSettings({theme: next});
    applySavedTheme();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    const register = () => navigator.serviceWorker.register('service-worker.js')
      .catch(error => console.warn('Service worker registration failed', error));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, {once: true});
  }

  function bindGlobalEvents() {
    $('#week-select').addEventListener('change', event => loadWeek(event.target.value));
    $('#phrase-search').addEventListener('input', renderVocabulary);
    $('#category-filter').addEventListener('change', renderVocabulary);
    $('#mark-lesson').addEventListener('click', () => {
      state.progress.lessonComplete = !state.progress.lessonComplete;
      saveProgress();
      updateLessonButton();
    });

    document.addEventListener('click', event => {
      const open = event.target.closest('[data-open-panel]');
      if (open) openPanel(open.dataset.openPanel);

      const tab = event.target.closest('[data-panel].tab');
      if (tab) openPanel(tab.dataset.panel);

      const speakButton = event.target.closest('[data-speak-id]');
      if (speakButton) {
        const item = state.lesson.vocabulary.find(entry => entry.id === speakButton.dataset.speakId);
        if (item) speak(item.tagalog);
      }

      const familiarButton = event.target.closest('[data-familiar-id]');
      if (familiarButton) {
        const id = familiarButton.dataset.familiarId;
        const set = new Set(state.progress.familiar);
        set.has(id) ? set.delete(id) : set.add(id);
        state.progress.familiar = [...set];
        saveProgress();
        renderVocabulary();
      }

      const generate = event.target.closest('[data-generate-builder]');
      if (generate) generateBuilder(generate.dataset.generateBuilder);

      const weekCard = event.target.closest('[data-week-card]');
      if (weekCard && !weekCard.classList.contains('is-planned')) loadWeek(weekCard.dataset.weekCard);
    });

    document.addEventListener('change', event => {
      if (event.target.matches('[data-builder-field]')) {
        const card = event.target.closest('[data-builder]');
        if (card) generateBuilder(card.dataset.builder);
      }

      if (event.target.matches('[data-mission-check]')) {
        const index = event.target.dataset.missionCheck;
        state.progress.missionChecks[index] = event.target.checked;
        saveProgress();
      }
    });

    $('.tab-list').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$('.tab');
      const current = tabs.indexOf(document.activeElement);
      let next = current;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      tabs[next].focus();
      openPanel(tabs[next].dataset.panel, false);
    });

    $('#review-reveal').addEventListener('click', revealReview);
    $('#review-speak').addEventListener('click', () => {
      const item = currentReviewItem();
      if (item) speak(item.tagalog);
    });
    $$('.rating-button').forEach(button => button.addEventListener('click', () => rateReview(button.dataset.rating)));

    $('#typing-check').addEventListener('click', checkTyping);
    $('#typing-reveal').addEventListener('click', () => {
      const item = currentTypingItem();
      if (item) showFeedback($('#typing-feedback'), item.tagalog, 'success');
    });
    $('#typing-next').addEventListener('click', nextTyping);
    $('#typing-answer').addEventListener('keydown', event => {
      if (event.key === 'Enter') checkTyping();
    });

    $('#quiz-form').addEventListener('submit', checkQuiz);
    $('#quiz-next').addEventListener('click', nextQuiz);

    $('#speak-phrase').addEventListener('change', updateShadowPhrase);
    $('#speak-slow').addEventListener('click', () => speak($('#shadow-tagalog').textContent, .68));
    $('#speak-normal').addEventListener('click', () => speak($('#shadow-tagalog').textContent, .9));
    $('#record-start').addEventListener('click', startRecording);
    $('#record-stop').addEventListener('click', stopRecording);

    $('#mark-mission').addEventListener('click', () => {
      state.progress.missionComplete = !state.progress.missionComplete;
      saveProgress();
      updateMissionButton();
    });

    $('#export-progress').addEventListener('click', exportProgress);
    $('#import-progress').addEventListener('change', event => {
      const [file] = event.target.files;
      if (file) importProgress(file);
      event.target.value = '';
    });
    $('#reset-week').addEventListener('click', resetCurrentWeek);
    $('#print-lesson').addEventListener('click', () => window.print());
    $('#theme-toggle').addEventListener('click', toggleTheme);

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredPrompt = event;
      $('#install-app').hidden = false;
    });

    $('#install-app').addEventListener('click', async () => {
      if (!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
      $('#install-app').hidden = true;
    });
  }

  init();
})();
