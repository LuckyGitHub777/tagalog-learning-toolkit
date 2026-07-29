import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  normalizeText,
  exerciseEnglish,
  explanationText,
  shuffle,
  defaultProgress,
  normalizeProgress,
  mergeItemProgress,
  progressPercent,
  scheduleReview,
  dueItems,
  makeQuiz
} from '../assets/js/core.js';

assert.equal(normalizeText('Taga-saan ka?'), 'taga saan ka');
assert.equal(explanationText({tagalog:'Anong kulay ito?', english:'What color is this?'}), 'Anong kulay ito? — What color is this?');

const ids = ['a', 'b'];
const malformed = normalizeProgress({familiar:'bad', review:null, typingCorrect:null, typingAttempts:null}, ids);
assert.deepEqual(malformed.familiar, []);
assert.deepEqual(malformed.review, {});
assert.deepEqual(malformed.typingCorrect, []);

const clean = normalizeProgress({familiar:['a','unknown','a'], typingCorrect:['b'], review:{a:{due:'bad',repetitions:-2}}}, ids);
assert.deepEqual(clean.familiar, ['a']);
assert.deepEqual(clean.typingCorrect, ['b']);
assert.equal(clean.review.a.repetitions, 0);

const migrated = mergeItemProgress(
  {...defaultProgress(), lessonComplete:false, quizBest:null, familiar:['a']},
  {...defaultProgress(), lessonComplete:true, quizBest:100, familiar:['b'], typingCorrect:['b']},
  ids
);
assert.equal(migrated.lessonComplete, false, 'legacy completion must not be copied');
assert.equal(migrated.quizBest, null, 'legacy quiz score must not be copied');
assert.deepEqual(new Set(migrated.familiar), new Set(['a','b']));
assert.deepEqual(migrated.typingCorrect, ['b']);

const now = Date.parse('2026-01-01T00:00:00Z');
assert.equal(scheduleReview({}, 'again', now).due, new Date(now + 10 * 60 * 1000).toISOString());
assert.equal(scheduleReview({}, 'hard', now).interval, 1);
assert.equal(scheduleReview({}, 'good', now).interval, 1);

const full = {
  ...defaultProgress(),
  lessonComplete:true,
  missionComplete:true,
  familiar:['a','b'],
  typingCorrect:['a','b'],
  quizBest:100,
  review:{a:{repetitions:3}, b:{repetitions:3}}
};
assert.equal(progressPercent(full, 2), 100);

const vocabulary = [
  {id:'a', practice:true, tagalog:'Isa', english:'One'},
  {id:'b', practice:true, tagalog:'Dalawa', english:'Two'}
];
assert.equal(dueItems(vocabulary, defaultProgress(), 12, now).length, 2);
assert.equal(makeQuiz(vocabulary, 10, () => .5).length, 2);

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

const distribution = [0, 0, 0];
const random = seededRandom(777);
for (let run = 0; run < 12000; run += 1) {
  distribution[shuffle([0,1,2], random)[0]] += 1;
}
for (const count of distribution) {
  assert.ok(count > 3600 && count < 4400, `Fisher-Yates distribution drifted: ${distribution}`);
}

const catalog = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
for (const meta of catalog.lessons) {
  const lesson = JSON.parse(await readFile(new URL(`../${meta.file}`, import.meta.url), 'utf8'));
  const practice = lesson.vocabulary.filter(item => item.practice);
  const prompts = practice.map(item => normalizeText(exerciseEnglish(item)));
  assert.equal(prompts.length, new Set(prompts).size, `${lesson.id} has an ambiguous exercise prompt`);

  for (let run = 1; run <= 250; run += 1) {
    const quiz = makeQuiz(lesson.vocabulary, 10, seededRandom(run));
    for (const question of quiz) {
      assert.ok(question.answer >= 0 && question.answer < question.choices.length, `${lesson.id}: invalid answer index`);
      const normalizedChoices = question.choices.map(normalizeText);
      assert.equal(normalizedChoices.length, new Set(normalizedChoices).size, `${lesson.id}: duplicate quiz choices`);
      const source = practice.find(item => item.id === question.sourceId);
      assert.ok(source, `${lesson.id}: missing source item`);
      const expected = question.prompt.startsWith('What does') ? exerciseEnglish(source) : source.tagalog;
      assert.equal(normalizeText(question.choices[question.answer]), normalizeText(expected), `${lesson.id}: wrong answer mapping`);
    }
  }
}

console.log('CORE TESTS PASS');
