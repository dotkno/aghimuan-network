/* ============================================================
   FLASHCARD ENGINE
   Generic flip-deck runner. Any subject page calls:

     FlashcardEngine.init(containerEl, cards, options)

   cards: [{ id: 'css-g11-f1', front: 'What is RAM?', back: 'Volatile...' }, ...]

   options: {
     title: 'CSS Grade 11 · Flashcards',
     storageKey: 'css-g11-flash',  // known-card ids persisted here
     shuffle: true,
     backHref: '../reviewers.html'
   }
   ============================================================ */

(function (global) {
  function init(container, cards, options) {
    options = options || {};
    const state = {
      deck: options.shuffle ? AghiLib.shuffle(cards) : cards.slice(),
      index: 0,
      flipped: false,
      known: [],
      learning: [],
    };

    render();

    function render() {
      if (state.index >= state.deck.length) return renderSummary();
      const card = state.deck[state.index];
      const pct = Math.round((state.index / state.deck.length) * 100);

      container.innerHTML = `
        <div class="flash-shell">
          <div class="flash-toolbar">
            <span class="flash-count">${options.title || 'FLASHCARDS'} &middot; ${state.index + 1}/${state.deck.length}</span>
            <span class="flash-count">KNOW ${state.known.length} &middot; LEARNING ${state.learning.length}</span>
          </div>
          <div class="lib-progress-track" style="margin-bottom:1rem;">
            <div class="lib-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="flash-stage">
            <div class="flash-card" id="flash-card">
              <div class="flash-face front neon-border-subject" style="border-width:1px;border-style:solid;">
                <div>${card.front}</div>
                <div class="hint">TAP TO FLIP</div>
              </div>
              <div class="flash-face back neon-border-subject" style="border-width:1px;border-style:solid;">
                <div>${card.back}</div>
                <div class="hint">TAP TO FLIP BACK</div>
              </div>
            </div>
          </div>
          <div class="flash-controls">
            <button class="flash-btn learning btn-neon" id="flash-learning-btn">STILL LEARNING</button>
            <button class="flash-btn know btn-neon" id="flash-know-btn">GOT IT</button>
          </div>
        </div>
      `;

      const cardEl = container.querySelector('#flash-card');
      cardEl.addEventListener('click', () => {
        state.flipped = !state.flipped;
        cardEl.classList.toggle('is-flipped', state.flipped);
      });

      container.querySelector('#flash-know-btn').addEventListener('click', () => advance(true));
      container.querySelector('#flash-learning-btn').addEventListener('click', () => advance(false));
    }

    function advance(knewIt) {
      const card = state.deck[state.index];
      (knewIt ? state.known : state.learning).push(card.id);
      state.index++;
      state.flipped = false;
      render();
    }

    function renderSummary() {
      if (options.storageKey) {
        AghiLib.LibraryProgress.set('flash:' + options.storageKey, { known: state.known, learning: state.learning, at: Date.now() });
      }

      container.innerHTML = `
        <div class="flash-shell">
          <div class="quiz-card flash-summary fade-up">
            <div class="font-display neon-subject" style="font-size:1.3rem;margin-bottom:.5rem;">DECK COMPLETE</div>
            <div class="stat"><span class="num" style="color:#4ade80;">${state.known.length}</span><span class="label">Know It</span></div>
            <div class="stat"><span class="num" style="color:#f87171;">${state.learning.length}</span><span class="label">Still Learning</span></div>
            <div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap;">
              ${state.learning.length ? `<button class="quiz-btn is-solid btn-neon" id="flash-review-btn">REVIEW MISSED (${state.learning.length})</button>` : ''}
              <button class="quiz-btn btn-neon" id="flash-restart-btn">RESTART DECK</button>
              ${options.backHref ? `<a href="${options.backHref}" class="quiz-btn btn-neon" style="text-decoration:none;">BACK</a>` : ''}
            </div>
          </div>
        </div>
      `;

      if (state.learning.length) {
        container.querySelector('#flash-review-btn').addEventListener('click', () => {
          const missedCards = cards.filter(c => state.learning.includes(c.id));
          state.deck = options.shuffle ? AghiLib.shuffle(missedCards) : missedCards;
          state.index = 0; state.flipped = false; state.known = []; state.learning = [];
          render();
        });
      }
      container.querySelector('#flash-restart-btn').addEventListener('click', () => {
        state.deck = options.shuffle ? AghiLib.shuffle(cards) : cards.slice();
        state.index = 0; state.flipped = false; state.known = []; state.learning = [];
        render();
      });
    }
  }

  global.FlashcardEngine = { init };
})(window);