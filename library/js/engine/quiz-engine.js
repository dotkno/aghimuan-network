/* ============================================================
   QUIZ ENGINE
   Generic MCQ runner. Any subject page calls:

     QuizEngine.init(containerEl, questions, options)

   questions: [{
     id: 'css-g11-q1',           // unique id (used for review/analytics)
     question: 'What does POST stand for?',
     options: ['Power-On Self Test', 'Post Office System Test', ...],
     correct: 0,                 // index into options
     explanation: 'POST runs at boot to check hardware.' // optional
   }, ...]

   options: {
     title: 'CSS Grade 11 · Quiz',
     storageKey: 'css-g11-quiz',  // best score persisted here, omit to disable
     shuffleQuestions: true,
     shuffleOptions: true,
     onComplete: (score, total) => {}
   }
   ============================================================ */

(function (global) {
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function init(container, questions, options) {
    options = options || {};
    const state = {
      deck: prepareDeck(questions, options),
      index: 0,
      score: 0,
      answered: false,
      log: [], // {id, question, chosenText, correctText, wasCorrect}
    };

    render();

    function prepareDeck(qs, opts) {
      let deck = qs.map(q => ({ ...q }));
      if (opts.shuffleQuestions) deck = AghiLib.shuffle(deck);
      if (opts.shuffleOptions) {
        deck = deck.map(q => {
          const correctText = q.options[q.correct];
          const shuffled = AghiLib.shuffle(q.options.map((text, i) => ({ text, i })));
          return { ...q, options: shuffled.map(o => o.text), correct: shuffled.findIndex(o => o.text === correctText) };
        });
      }
      return deck;
    }

    function render() {
      if (state.index >= state.deck.length) return renderResults();
      const q = state.deck[state.index];
      const pct = Math.round((state.index / state.deck.length) * 100);

      container.innerHTML = `
        <div class="quiz-shell">
          <div class="quiz-meta">
            <span>${options.title || 'QUIZ'}</span>
            <span>QUESTION ${state.index + 1} / ${state.deck.length}</span>
          </div>
          <div class="lib-progress-track" style="margin-bottom:1rem;">
            <div class="lib-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="quiz-card fade-up">
            <div class="quiz-question">${q.question}</div>
            <div class="quiz-options" id="quiz-options"></div>
            <div id="quiz-explanation-slot"></div>
            <div class="quiz-footer">
              <span style="font-size:.75rem;color:rgba(255,255,255,.4);font-family:'Orbitron',sans-serif;">SCORE: ${state.score}</span>
              <button class="quiz-btn is-solid btn-neon hidden" id="quiz-next-btn">
                ${state.index + 1 >= state.deck.length ? 'SEE RESULTS' : 'NEXT'} &#8594;
              </button>
            </div>
          </div>
        </div>
      `;

      const optionsEl = container.querySelector('#quiz-options');
      q.options.forEach((text, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option btn-neon';
        btn.innerHTML = `<span class="quiz-option-letter">${LETTERS[i]}</span><span>${text}</span>`;
        btn.addEventListener('click', () => selectOption(i));
        optionsEl.appendChild(btn);
      });

      container.querySelector('#quiz-next-btn').addEventListener('click', () => {
        state.index++;
        state.answered = false;
        render();
      });
    }

    function selectOption(chosenIndex) {
      if (state.answered) return;
      state.answered = true;
      const q = state.deck[state.index];
      const wasCorrect = chosenIndex === q.correct;
      if (wasCorrect) state.score++;

      state.log.push({
        id: q.id, question: q.question,
        chosenText: q.options[chosenIndex], correctText: q.options[q.correct],
        wasCorrect,
      });

      const optionEls = container.querySelectorAll('.quiz-option');
      optionEls.forEach((el, i) => {
        el.disabled = true;
        if (i === q.correct) el.classList.add('is-correct');
        if (i === chosenIndex && !wasCorrect) el.classList.add('is-wrong');
      });

      if (q.explanation) {
        container.querySelector('#quiz-explanation-slot').innerHTML =
          `<div class="quiz-explanation fade-up">${q.explanation}</div>`;
      }
      container.querySelector('#quiz-next-btn').classList.remove('hidden');
    }

    function renderResults() {
      const total = state.deck.length;
      const pct = Math.round((state.score / total) * 100);

      let best = null;
      if (options.storageKey) {
        const prevBest = AghiLib.LibraryProgress.get('quiz:' + options.storageKey, null);
        best = prevBest && prevBest.pct >= pct ? prevBest : { score: state.score, total, pct };
        AghiLib.LibraryProgress.set('quiz:' + options.storageKey, best);
      }

      container.innerHTML = `
        <div class="quiz-shell">
          <div class="quiz-card quiz-results fade-up">
            <div class="quiz-score-ring">${pct}%</div>
            <div class="font-display" style="font-size:1.1rem;">${state.score} / ${total} correct</div>
            ${best ? `<div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-top:.4rem;">BEST: ${best.pct}%</div>` : ''}
            <div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.5rem;">
              <button class="quiz-btn btn-neon" id="quiz-retry-btn">RETRY</button>
              ${options.backHref ? `<a href="${options.backHref}" class="quiz-btn is-solid btn-neon" style="text-decoration:none;">BACK</a>` : ''}
            </div>
            <div class="quiz-review-list">
              ${state.log.map(l => `
                <div class="quiz-review-item ${l.wasCorrect ? 'correct' : 'missed'}">
                  <div class="tag" style="color:${l.wasCorrect ? '#4ade80' : '#f87171'}">${l.wasCorrect ? 'CORRECT' : 'MISSED'}</div>
                  <div>${l.question}</div>
                  ${!l.wasCorrect ? `<div style="color:rgba(255,255,255,.5);margin-top:.2rem;">Correct answer: ${l.correctText}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      container.querySelector('#quiz-retry-btn').addEventListener('click', () => {
        state.deck = prepareDeck(questions, options);
        state.index = 0; state.score = 0; state.answered = false; state.log = [];
        render();
      });

      if (typeof options.onComplete === 'function') options.onComplete(state.score, total);
    }
  }

  global.QuizEngine = { init };
})(window);