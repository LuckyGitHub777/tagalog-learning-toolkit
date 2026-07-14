(() => {
  'use strict';

  const STORAGE_KEY = 'tagalog-learning-toolkit.v2';
  const DAY = 24 * 60 * 60 * 1000;
  const REVIEW_SIZE = 10;

  const state = {
    data: null,
    progress: null,
    typingItems: [],
    typingIndex: 0,
    quizOrder: [],
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false,
    reviewQueue: [],
    reviewIndex: 0,
    mediaRecorder: null,
    mediaChunks: [],
    recordingUrl: null,
    installPrompt: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function defaultProgress() {
    return {
      version: 2,
      lessonComplete: false,
      quizBest: 0,
      typingCorrect: [],
      familiar: [],
      mastery: {},
      builders: { intro: {}, family: {} },
      homework: {},
      updatedAt: new Date().toISOString()
    };
  }

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return parsed && parsed.version === 2 ? {...defaultProgress(), ...parsed} : defaultProgress();
    } catch (_) {
      return defaultProgress();
    }
  }

  function saveProgress() {
    state.progress.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); } catch (_) {}
    updateDashboard();
  }

  function normalize(value) {
    return String(value).toLowerCase().trim()
      .normalize('NFKC')
      .replace(/[.!?,;:]+$/g, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function download(filename, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function copyText(text, statusElement) {
    if (!text || text.startsWith('Your ') || text.startsWith('Add ')) {
      statusElement.textContent = 'Build a sentence first.';
      return;
    }
    if (!navigator.clipboard?.writeText) {
      statusElement.textContent = 'Copy is unavailable. Select the text manually.';
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      statusElement.textContent = 'Copied.';
      setTimeout(() => { statusElement.textContent = ''; }, 1800);
    }).catch(() => {
      statusElement.textContent = 'Copy is unavailable. Select the text manually.';
    });
  }

  function speak(text, rate = 0.9) {
    if (!('speechSynthesis' in window)) {
      alert('Speech playback is not supported by this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text).replace(/____/g, '').replace(/\s*\/\s*.*/, ''));
    utterance.lang = 'fil-PH';
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(item => /^fil(-|_)/i.test(item.lang)) || voices.find(item => /philipp/i.test(item.name));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function openPanel(panelId, focus = true) {
    $$('.tab').forEach(tab => {
      const active = tab.dataset.panel === panelId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $$('.panel').forEach(panel => {
      const active = panel.id === panelId;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    history.replaceState(null, '', `#${panelId}`);
    if (focus) document.getElementById(panelId)?.focus({preventScroll: true});
  }

  function bindTabKeyboard() {
    const tabs = $$('.tab');
    tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
      let target = null;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== null) {
        event.preventDefault();
        tabs[target].focus();
        openPanel(tabs[target].dataset.panel, false);
      }
    }));
  }

  function practiceItems() {
    return state.data.vocabulary.filter(item => item.accepted?.length && !item.tagalog.includes('____'));
  }

  function categories() {
    return [...new Set(state.data.vocabulary.map(item => item.category))];
  }

  function renderLessons() {
    const query = normalize($('#phrase-search').value);
    const category = $('#category-filter').value;
    const items = state.data.vocabulary.filter(item => {
      const categoryMatch = category === 'all' || item.category === category;
      const haystack = normalize(`${item.category} ${item.tagalog} ${item.english} ${item.note || ''}`);
      return categoryMatch && (!query || haystack.includes(query));
    });
    const groups = items.reduce((acc, item) => {
      (acc[item.category] ||= []).push(item);
      return acc;
    }, {});
    const container = $('#lesson-groups');
    if (!items.length) {
      container.innerHTML = '<p class="empty-state">No phrases match that search.</p>';
      return;
    }
    container.innerHTML = Object.entries(groups).map(([categoryName, groupItems]) => `
      <article class="lesson-group">
        <h3>${escapeHtml(categoryName)}</h3>
        ${groupItems.map(item => {
          const familiar = state.progress.familiar.includes(item.id);
          return `<div class="phrase-row">
            <div><strong lang="fil">${escapeHtml(item.tagalog)}</strong>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div>
            <div class="phrase-english">${escapeHtml(item.english)}</div>
            <button class="icon-button speak-phrase" type="button" data-id="${escapeHtml(item.id)}" aria-label="Hear ${escapeHtml(item.tagalog)}">▶</button>
            <button class="icon-button familiar-phrase${familiar ? ' is-familiar' : ''}" type="button" data-id="${escapeHtml(item.id)}" aria-pressed="${String(familiar)}" aria-label="${familiar ? 'Remove familiar mark from' : 'Mark as familiar:'} ${escapeHtml(item.tagalog)}">✓</button>
          </div>`;
        }).join('')}
      </article>`).join('');
    $$('.speak-phrase').forEach(button => button.addEventListener('click', () => {
      const item = state.data.vocabulary.find(entry => entry.id === button.dataset.id);
      if (item) speak(item.tagalog);
    }));
    $$('.familiar-phrase').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.id;
      const set = new Set(state.progress.familiar);
      if (set.has(id)) set.delete(id); else set.add(id);
      state.progress.familiar = [...set];
      saveProgress();
      renderLessons();
    }));
  }

  function prepareCategoryFilter() {
    $('#category-filter').innerHTML = '<option value="all">All categories</option>' + categories()
      .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  function reviewRecord(id) {
    return state.progress.mastery[id] || {level: 0, reviews: 0, nextReview: 0, lastReviewed: null};
  }

  function prepareReviewQueue() {
    const now = Date.now();
    state.reviewQueue = practiceItems()
      .map(item => ({item, record: reviewRecord(item.id)}))
      .sort((a, b) => {
        const aDue = a.record.nextReview <= now ? 0 : 1;
        const bDue = b.record.nextReview <= now ? 0 : 1;
        return aDue - bDue || a.record.level - b.record.level || a.record.nextReview - b.record.nextReview;
      })
      .slice(0, REVIEW_SIZE)
      .map(entry => entry.item);
    state.reviewIndex = 0;
    renderReview();
  }

  function renderReview() {
    const item = state.reviewQueue[state.reviewIndex];
    const answer = $('#review-answer');
    $('#review-ratings').hidden = true;
    $('#review-controls').hidden = false;
    $('#review-feedback').textContent = '';
    if (!item) {
      $('#review-counter').textContent = 'Complete';
      $('#review-prompt').textContent = 'Daily session complete.';
      answer.hidden = false;
      $('strong', answer).textContent = 'Magaling!';
      $('span', answer).textContent = 'Great work. Return tomorrow for a refreshed queue.';
      $('#review-controls').hidden = true;
      return;
    }
    $('#review-counter').textContent = `${state.reviewIndex + 1} / ${state.reviewQueue.length}`;
    $('#review-prompt').textContent = item.english;
    answer.hidden = true;
    $('strong', answer).textContent = item.tagalog;
    $('span', answer).textContent = item.note || item.english;
  }

  function revealReview() {
    $('#review-answer').hidden = false;
    $('#review-ratings').hidden = false;
    $('#review-controls').hidden = true;
  }

  function rateReview(rating) {
    const item = state.reviewQueue[state.reviewIndex];
    if (!item) return;
    const now = Date.now();
    const current = reviewRecord(item.id);
    let level = current.level || 0;
    let nextReview = now;
    if (rating === 'again') {
      level = Math.max(0, level - 1);
      nextReview = now + 10 * 60 * 1000;
    } else if (rating === 'hard') {
      level = Math.max(1, level);
      nextReview = now + DAY;
    } else {
      level = Math.min(5, level + 1);
      const intervals = [0, 1, 3, 7, 14, 30];
      nextReview = now + intervals[level] * DAY;
    }
    state.progress.mastery[item.id] = {
      level,
      reviews: (current.reviews || 0) + 1,
      lastReviewed: new Date(now).toISOString(),
      nextReview
    };
    saveProgress();
    state.reviewIndex += 1;
    renderReview();
  }

  function prepareTyping() {
    state.typingItems = practiceItems().filter(item => !item.tagalog.includes('/'));
    state.typingIndex = 0;
    renderTyping();
  }

  function renderTyping() {
    const item = state.typingItems[state.typingIndex];
    $('#typing-count').textContent = `${state.typingIndex + 1} / ${state.typingItems.length}`;
    $('#typing-prompt').textContent = item.english;
    $('#typing-answer').value = '';
    $('#typing-feedback').textContent = '';
    $('#typing-feedback').className = 'feedback';
  }

  function checkTyping() {
    const item = state.typingItems[state.typingIndex];
    const answer = normalize($('#typing-answer').value);
    const accepted = item.accepted.map(normalize);
    const feedback = $('#typing-feedback');
    if (!answer) {
      feedback.textContent = 'Type an answer first.';
      feedback.className = 'feedback error';
      return;
    }
    if (accepted.includes(answer)) {
      feedback.textContent = `Correct: ${item.tagalog}`;
      feedback.className = 'feedback success';
      if (!state.progress.typingCorrect.includes(item.id)) state.progress.typingCorrect.push(item.id);
      saveProgress();
    } else {
      feedback.textContent = `Not yet. Compare your answer with: ${item.tagalog}`;
      feedback.className = 'feedback error';
    }
  }

  function shuffledIndexes(length) {
    const values = Array.from({length}, (_, index) => index);
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function prepareQuiz() {
    state.quizOrder = shuffledIndexes(state.data.quiz.length);
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    $('#quiz-form').hidden = false;
    $('#quiz-result').hidden = true;
    renderQuiz();
  }

  function quizItem() {
    return state.data.quiz[state.quizOrder[state.quizIndex]];
  }

  function renderQuiz() {
    const item = quizItem();
    $('#quiz-progress').textContent = `Question ${state.quizIndex + 1} of ${state.data.quiz.length}`;
    $('#quiz-question').textContent = item.question;
    $('#quiz-choices').innerHTML = item.choices.map((choice, index) => `
      <label class="choice"><input type="radio" name="quiz-choice" value="${index}"><span>${escapeHtml(choice)}</span></label>`).join('');
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
    const feedback = $('#quiz-feedback');
    if (!selected) {
      feedback.textContent = 'Choose an answer.';
      feedback.className = 'feedback error';
      return;
    }
    const item = quizItem();
    const correct = Number(selected.value) === item.answer;
    if (correct) state.quizScore += 1;
    feedback.textContent = `${correct ? 'Correct.' : `Correct answer: ${item.choices[item.answer]}`} ${item.explanation}`;
    feedback.className = `feedback ${correct ? 'success' : 'error'}`;
    $$('input[name="quiz-choice"]').forEach(input => { input.disabled = true; });
    state.quizAnswered = true;
    $('#quiz-submit').hidden = true;
    $('#quiz-next').hidden = false;
    $('#quiz-next').textContent = state.quizIndex === state.data.quiz.length - 1 ? 'See result' : 'Next question';
  }

  function nextQuiz() {
    if (!state.quizAnswered) return;
    if (state.quizIndex < state.data.quiz.length - 1) {
      state.quizIndex += 1;
      renderQuiz();
      return;
    }
    const percent = Math.round(state.quizScore / state.data.quiz.length * 100);
    state.progress.quizBest = Math.max(state.progress.quizBest, percent);
    saveProgress();
    $('#quiz-form').hidden = true;
    $('#quiz-feedback').textContent = '';
    const result = $('#quiz-result');
    result.hidden = false;
    result.innerHTML = `<strong>${state.quizScore} / ${state.data.quiz.length} (${percent}%)</strong><br>${percent >= 80 ? 'Strong result. Apply the language in the builders.' : 'Review missed ideas and try a fresh question order.'}<br><button id="quiz-restart" class="button button-secondary" type="button">Retake quiz</button>`;
    $('#quiz-restart').addEventListener('click', prepareQuiz);
  }

  function prepareSpeakMode() {
    const items = practiceItems();
    $('#speak-phrase').innerHTML = items.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.tagalog)} — ${escapeHtml(item.english)}</option>`).join('');
    renderSpeakPhrase();
  }

  function selectedSpeakItem() {
    return state.data.vocabulary.find(item => item.id === $('#speak-phrase').value) || practiceItems()[0];
  }

  function renderSpeakPhrase() {
    const item = selectedSpeakItem();
    $('#shadow-tagalog').textContent = item.tagalog;
    $('#shadow-english').textContent = item.english;
  }

  async function startRecording() {
    const status = $('#record-status');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      status.textContent = 'Audio recording is not supported in this browser. You can still shadow the phrase aloud.';
      status.className = 'feedback error';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      state.mediaChunks = [];
      state.mediaRecorder = new MediaRecorder(stream);
      state.mediaRecorder.addEventListener('dataavailable', event => { if (event.data.size) state.mediaChunks.push(event.data); });
      state.mediaRecorder.addEventListener('stop', () => {
        stream.getTracks().forEach(track => track.stop());
        if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
        const blob = new Blob(state.mediaChunks, {type: state.mediaRecorder.mimeType || 'audio/webm'});
        state.recordingUrl = URL.createObjectURL(blob);
        $('#record-playback').src = state.recordingUrl;
        $('#record-playback').hidden = false;
        status.textContent = 'Recording ready. Listen and compare it with the model phrase.';
        status.className = 'feedback success';
      });
      state.mediaRecorder.start();
      $('#record-start').hidden = true;
      $('#record-stop').hidden = false;
      status.textContent = 'Recording… Speak naturally, then press stop.';
      status.className = 'feedback';
    } catch (_) {
      status.textContent = 'Microphone access was not granted. Nothing was recorded or uploaded.';
      status.className = 'feedback error';
    }
  }

  function stopRecording() {
    if (state.mediaRecorder?.state === 'recording') state.mediaRecorder.stop();
    $('#record-start').hidden = false;
    $('#record-stop').hidden = true;
  }

  function fillAdjectives() {
    $('#family-adjective').innerHTML = state.data.adjectives.map(item => `<option value="${escapeHtml(item.tagalog)}">${escapeHtml(item.tagalog)} — ${escapeHtml(item.english)}</option>`).join('');
  }

  function restoreBuilders() {
    const intro = state.progress.builders.intro || {};
    ['name','origin','school','subject','feeling'].forEach(key => {
      const field = $(`#intro-builder [name="${key}"]`);
      if (field && intro[key]) field.value = intro[key];
    });
    if (intro.output) $('#intro-output').value = intro.output;
    const family = state.progress.builders.family || {};
    if (family.person) $('#family-person').value = family.person;
    if (family.adjective) $('#family-adjective').value = family.adjective;
    if (family.output) $('#family-output').value = family.output;
  }

  function buildIntro(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value).trim()]));
    const lines = [
      values.name && `Ako si ${values.name}.`,
      values.origin && `Taga-${values.origin} ako.`,
      values.school && `Nag-aaral ako sa ${values.school}.`,
      values.subject && `Nag-aaral ako ng ${values.subject}.`,
      values.feeling
    ].filter(Boolean);
    const valid = lines.length > 0;
    const output = valid ? lines.join('\n') : 'Add at least one detail.';
    $('#intro-output').value = output;
    state.progress.builders.intro = {...values, output: valid ? output : ''};
    saveProgress();
  }

  function buildFamily(event) {
    event.preventDefault();
    const person = $('#family-person').value.trim();
    const adjective = $('#family-adjective').value;
    const output = person ? `${adjective} si ${person}.` : 'Add a family member or name.';
    $('#family-output').value = output;
    state.progress.builders.family = {person, adjective, output: person ? output : ''};
    saveProgress();
  }

  function restoreHomework() {
    Object.entries(state.progress.homework || {}).forEach(([name, value]) => {
      const field = $(`#homework-form [name="${name}"]`);
      if (field) field.value = value;
    });
  }

  function collectHomework() {
    return Object.fromEntries([...new FormData($('#homework-form')).entries()].map(([key, value]) => [key, String(value).trim()]));
  }

  function saveHomework(event) {
    event?.preventDefault();
    state.progress.homework = collectHomework();
    saveProgress();
    $('#homework-status').textContent = 'Challenge saved on this device.';
    $('#homework-status').className = 'feedback success';
  }

  function updateDashboard() {
    if (!state.data || !state.progress) return;
    const items = practiceItems();
    const now = Date.now();
    const records = items.map(item => reviewRecord(item.id));
    const due = records.filter(record => !record.nextReview || record.nextReview <= now).length;
    const levels = records.reduce((sum, record) => sum + (record.level || 0), 0);
    const mastery = items.length ? Math.round(levels / (items.length * 5) * 100) : 0;
    const learned = records.filter(record => record.level >= 2).length;
    const builderComplete = Boolean(state.progress.builders.intro?.output) && Boolean(state.progress.builders.family?.output);
    const homeworkFields = Object.values(state.progress.homework || {}).filter(Boolean).length;
    const homeworkPercent = Math.min(100, Math.round(homeworkFields / 22 * 100));
    const progress = Math.round(
      (state.progress.lessonComplete ? 15 : 0) +
      Math.min(20, state.progress.quizBest * .2) +
      Math.min(15, state.progress.typingCorrect.length / Math.max(1, state.typingItems.length) * 15) +
      mastery * .2 +
      (builderComplete ? 15 : 0) +
      homeworkPercent * .15
    );
    $('#due-count').textContent = String(due);
    $('#mastery-count').textContent = `${mastery}%`;
    $('#best-quiz').textContent = state.progress.quizBest ? `${state.progress.quizBest}%` : '—';
    $('#known-count').textContent = `${learned} learned`;
    $('#progress-label').textContent = `${Math.min(100, progress)}% course progress`;
    $('#progress-fill').style.width = `${Math.min(100, progress)}%`;
    $('.progress-track').setAttribute('aria-valuenow', String(Math.min(100, progress)));
    $('#dashboard-status').textContent = due ? `${due} phrase${due === 1 ? '' : 's'} ready for review` : 'Review queue is current';
  }

  function exportProgress() {
    const payload = {
      app: 'Tagalog Learning Toolkit',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      progress: state.progress
    };
    download(`tagalog-progress-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    $('#data-status').textContent = 'Progress exported.';
    $('#data-status').className = 'feedback success';
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        const payload = JSON.parse(String(reader.result));
        if (payload.app !== 'Tagalog Learning Toolkit' || payload.schemaVersion !== 2 || !payload.progress) throw new Error('Unsupported file');
        state.progress = {...defaultProgress(), ...payload.progress, version: 2};
        saveProgress();
        location.reload();
      } catch (_) {
        $('#data-status').textContent = 'That file is not a valid Tagalog Learning Toolkit progress backup.';
        $('#data-status').className = 'feedback error';
      }
    });
    reader.readAsText(file);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    $('#theme-toggle').textContent = dark ? 'Light mode' : 'Dark mode';
    $('#theme-toggle').setAttribute('aria-pressed', String(dark));
    try { localStorage.setItem('tagalog-toolkit-theme', theme); } catch (_) {}
  }

  function bindEvents() {
    $$('.tab').forEach(tab => tab.addEventListener('click', () => openPanel(tab.dataset.panel)));
    bindTabKeyboard();
    $$('[data-open-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.openPanel)));
    $('#phrase-search').addEventListener('input', renderLessons);
    $('#category-filter').addEventListener('change', renderLessons);
    $('#mark-lesson').addEventListener('click', () => {
      state.progress.lessonComplete = true;
      saveProgress();
      $('#mark-lesson').textContent = 'Lesson complete ✓';
    });
    $('#review-reveal').addEventListener('click', revealReview);
    $('#review-speak').addEventListener('click', () => {
      const item = state.reviewQueue[state.reviewIndex];
      if (item) speak(item.tagalog);
    });
    $$('.rating-button').forEach(button => button.addEventListener('click', () => rateReview(button.dataset.rating)));
    $('#typing-check').addEventListener('click', checkTyping);
    $('#typing-reveal').addEventListener('click', () => {
      const item = state.typingItems[state.typingIndex];
      $('#typing-feedback').textContent = item.tagalog;
      $('#typing-feedback').className = 'feedback';
    });
    $('#typing-next').addEventListener('click', () => {
      state.typingIndex = (state.typingIndex + 1) % state.typingItems.length;
      renderTyping();
    });
    $('#typing-answer').addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); checkTyping(); }
    });
    $('#quiz-form').addEventListener('submit', checkQuiz);
    $('#quiz-next').addEventListener('click', nextQuiz);
    $('#speak-phrase').addEventListener('change', renderSpeakPhrase);
    $('#speak-slow').addEventListener('click', () => speak(selectedSpeakItem().tagalog, .68));
    $('#speak-normal').addEventListener('click', () => speak(selectedSpeakItem().tagalog, .92));
    $('#record-start').addEventListener('click', startRecording);
    $('#record-stop').addEventListener('click', stopRecording);
    $('#intro-builder').addEventListener('submit', buildIntro);
    $('#family-builder').addEventListener('submit', buildFamily);
    $('#intro-copy').addEventListener('click', () => copyText($('#intro-output').value, $('#intro-status')));
    $('#family-copy').addEventListener('click', () => copyText($('#family-output').value, $('#family-status')));
    $('#intro-speak').addEventListener('click', () => speak($('#intro-output').value));
    $('#family-speak').addEventListener('click', () => speak($('#family-output').value));
    $('#intro-output').addEventListener('input', () => {
      state.progress.builders.intro = {...state.progress.builders.intro, output: $('#intro-output').value};
      saveProgress();
    });
    $('#family-output').addEventListener('input', () => {
      state.progress.builders.family = {...state.progress.builders.family, output: $('#family-output').value};
      saveProgress();
    });
    $('#homework-form').addEventListener('submit', saveHomework);
    $('#homework-form').addEventListener('input', () => {
      state.progress.homework = collectHomework();
      saveProgress();
    });
    $('#print-homework').addEventListener('click', () => window.print());
    $('#clear-homework').addEventListener('click', () => {
      if (!confirm('Clear every Week 1 challenge answer?')) return;
      $('#homework-form').reset();
      state.progress.homework = {};
      saveProgress();
      $('#homework-status').textContent = 'Answers cleared.';
      $('#homework-status').className = 'feedback';
    });
    $('#export-progress').addEventListener('click', exportProgress);
    $('#import-progress').addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) importProgress(file);
    });
    $('#reset-progress').addEventListener('click', () => {
      if (!confirm('Reset all learning progress and saved answers on this device?')) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      location.reload();
    });
    $('#theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.installPrompt = event;
      $('#install-app').hidden = false;
    });
    $('#install-app').addEventListener('click', async () => {
      if (!state.installPrompt) return;
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      $('#install-app').hidden = true;
    });
  }

  async function init() {
    try {
      state.progress = loadProgress();
      const response = await fetch('data/lessons/week1.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      prepareCategoryFilter();
      renderLessons();
      prepareTyping();
      prepareQuiz();
      prepareReviewQueue();
      prepareSpeakMode();
      fillAdjectives();
      restoreBuilders();
      restoreHomework();
      bindEvents();
      if (state.progress.lessonComplete) $('#mark-lesson').textContent = 'Lesson complete ✓';
      const preferred = (() => { try { return localStorage.getItem('tagalog-toolkit-theme'); } catch (_) { return null; } })();
      applyTheme(preferred || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      updateDashboard();
      const initial = location.hash.replace('#', '');
      if (['learn','practice','speak','build','homework','resources'].includes(initial)) openPanel(initial, false);
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js').catch(() => {});
    } catch (error) {
      $('#main').innerHTML = `<section class="panel"><h1>Unable to load the lesson</h1><p>Serve this folder with GitHub Pages or a local web server. Opening the HTML file directly may block the lesson data.</p><pre>${escapeHtml(error.message)}</pre></section>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
