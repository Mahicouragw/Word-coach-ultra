/* ============================================================
   Word Coach Ultra v1.0.0 — TalkBack-first vocabulary games
   Flashcards · Meaning Quiz · Spelling Bee · Word Chain · Word of
   the Day. English + Telugu. Fully offline. Rewards & levels.
   ============================================================ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const BANK = window.WORD_BANK || [];
const WORDS = BANK.map(([word, meaning, telugu, example, level]) => ({ word, meaning, telugu, example, level }));

// ---------------- rewards ----------------
const KEY = 'wcu_progress_v1';
const defaults = { coins: 0, xp: 0, streak: 0, bestStreak: 0, lastDaily: '', games: 0, known: [], review: [], right: 0, wrong: 0 };
let prog = defaults;
try { prog = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const saveProg = () => localStorage.setItem(KEY, JSON.stringify(prog));
const level = () => 1 + Math.floor(prog.xp / 100);

// v2.0.0 — word mastery tracking: correct answers grow the "known" list, wrong
// answers go to the Review Deck so weak words always come back.
function rememberResult(word, correct) {
    const key = word.toLowerCase();
    prog.right += correct ? 1 : 0;
    prog.wrong += correct ? 0 : 1;
    if (correct) {
        if (!prog.known.includes(key)) prog.known.push(key);
        prog.review = (prog.review || []).filter(w => w.toLowerCase() !== key);
    } else {
        if (!prog.review.includes(key)) prog.review.push(key);
    }
    if (prog.review.length > 100) prog.review = prog.review.slice(-100);
    saveProg();
}

function addCoins(n, why) {
    prog.coins += n; prog.xp += Math.max(0, n);
    saveProg(); renderWallet();
    if (n > 0 && why) announce(`+${n} coins — ${why}. Total ${prog.coins} coins. Level ${level()}.`);
}
function bumpStreak(win) {
    prog.streak = win ? prog.streak + 1 : 0;
    prog.bestStreak = Math.max(prog.bestStreak, prog.streak);
    saveProg(); renderWallet();
}
function renderWallet() {
    $('w-coins').textContent = `🪙 ${prog.coins}`;
    $('w-level').textContent = `⭐ Lv ${level()}`;
    $('w-streak').textContent = `🔥 ${prog.streak}`;
}

// ---------------- a11y + audio ----------------
function announce(text, assertive) {
    const el = assertive ? $('aria-alert') : $('aria-log');
    el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30);
}
let settings = { tts: true, rate: 1.0, sounds: true, light: false, large: false };
try { settings = Object.assign(settings, JSON.parse(localStorage.getItem('wcu_settings_v1') || '{}')); } catch (e) {}
const saveSettings = () => localStorage.setItem('wcu_settings_v1', JSON.stringify(settings));
let audioCtx = null;
// v2.0.1 — real royalty-free sounds (Kenney.nl CC0), preloaded + cached for offline.
const SFX_FILES = {
    good: 'sounds/ui-good.ogg',
    bad: 'sounds/ui-bad.ogg',
    coin: 'sounds/ui-coin.ogg',
    flip: 'sounds/ui-flip.ogg',
    click: 'sounds/ui-click.ogg',
};
const sfxCache = {};
function sfx(kind) {
    if (!settings.sounds) return;
    const url = SFX_FILES[kind] || SFX_FILES.click;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        // Preload + cache the decoded buffer on first use (offline-safe).
        const playCached = (buffer) => {
            const src = audioCtx.createBufferSource();
            src.buffer = buffer;
            const g = audioCtx.createGain();
            g.gain.value = 0.5;
            src.connect(g).connect(audioCtx.destination);
            src.start(0);
        };
        if (sfxCache[url]) { playCached(sfxCache[url]); return; }
        fetch(url)
            .then(r => r.arrayBuffer())
            .then(buf => audioCtx.decodeAudioData(buf))
            .then(decoded => { sfxCache[url] = decoded; playCached(decoded); })
            .catch(() => { /* file unavailable — stay silent rather than synthesize */ });
    } catch (e) {}
}
function say(text, slow) {
    if (!settings.tts || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    u.rate = (settings.rate || 1) * (slow ? 0.75 : 1);
    speechSynthesis.speak(u);
}
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const pool = () => { const lv = parseInt($('level-select').value, 10); return lv === 0 ? WORDS : WORDS.filter(w => w.level === lv); };

// ---------------- navigation ----------------
let current = null;
function showHome() {
    current = null;
    $('game-panel').hidden = true; $('home').hidden = false;
    document.querySelectorAll('.game-btn').forEach(b => b.disabled = false);
}
function startGame(name) {
    current = name;
    $('home').hidden = true; $('game-panel').hidden = false;
    $('game-status').textContent = '';
    GAMES[name].start();
}
function setStage(html) { $('game-stage').innerHTML = html; }
function setStatus(t) { $('game-status').textContent = t; }
const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

// ---------------- Word of the Day ----------------
function wotd() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const w = WORDS[seed % WORDS.length];
    $('wotd-word').textContent = w.word;
    $('wotd-meaning').textContent = w.meaning;
    $('wotd-telugu').textContent = `తెలుగు: ${w.telugu}`;
    $('wotd-example').textContent = `“${w.example}”`;
    $('wotd-hear').onclick = () => say(`${w.word}. ${w.meaning}. Example: ${w.example}`);
}

// ---------------- Game 1: Flashcards ----------------
const flash = {
    queue: [], card: null, flipped: false, knownCount: 0,
    start() {
        $('game-title').textContent = '🃏 Flashcards';
        this.queue = shuffle(pool()); this.knownCount = 0; this.flipped = false;
        const total = this.queue.length;
        announce(`Flashcards started with ${total} words. Hear each word, flip to see the meaning, then mark Know or Again.`);
        this.next();
    },
    next() {
        if (!this.queue.length) return this.finish();
        this.card = this.queue[0]; this.flipped = false;
        setStatus(`Card ${this.knownCount + 1} — ${this.queue.length} left`);
        setStage(`<div class="flash-card">
            <p class="big-word" id="fc-word">${esc(this.card.word)}</p>
            <div id="fc-back" hidden>
              <p><strong>${esc(this.card.meaning)}</strong></p>
              <p class="telugu">తెలుగు: ${esc(this.card.telugu)}</p>
              <p class="example">“${esc(this.card.example)}”</p>
            </div></div>
          <div class="row">
            <button class="primary" id="fc-hear">🔊 Hear</button>
            <button class="primary" id="fc-flip">Flip</button>
            <button id="fc-know" hidden>✅ Know (+2 🪙)</button>
            <button id="fc-again" hidden>🔁 Again</button>
          </div>
          <p class="progress-line" id="fc-progress"></p>`);
        $('fc-hear').onclick = () => say(`${this.card.word}. ${this.flipped ? this.card.meaning + '. ' + this.card.example : ''}`);
        $('fc-flip').onclick = () => {
            this.flipped = !this.flipped;
            $('fc-back').hidden = !this.flipped;
            $('fc-know').hidden = $('fc-again').hidden = !this.flipped;
            sfx('flip');
            if (this.flipped) { announce(`${this.card.word} means: ${this.card.meaning}. Telugu: ${this.card.telugu}`); say(`${this.card.word}. ${this.card.meaning}`); }
        };
        $('fc-know').onclick = () => { this.queue.shift(); this.knownCount++; rememberResult(this.card.word, true); addCoins(2, 'word learned'); sfx('coin'); this.next(); };
        $('fc-again').onclick = () => { const c = this.queue.shift(); this.queue.splice(Math.min(3, this.queue.length), 0, c); rememberResult(c.word, false); announce(`${c.word} will come back soon — it is saved to your Review Deck.`); this.next(); };
        say(this.card.word);
    },
    finish() {
        prog.games++; saveProg();
        setStage(`<p class="big-word">🎉 Deck complete!</p><p>You reviewed every card. Coins: 🪙 ${prog.coins}. Level ${level()}.</p>
          <div class="row"><button class="primary" id="fc-restart">🔁 New deck</button><button class="primary" id="fc-menu">← Menu</button></div>`);
        setStatus(''); announce('Flashcards complete. Well done!'); say('Deck complete. Well done!');
        $('fc-restart').onclick = () => this.start();
        $('fc-menu').onclick = showHome;
    }
};

// ---------------- Game 2: Meaning Quiz ----------------
const quiz = {
    list: [], i: 0, score: 0,
    start() {
        $('game-title').textContent = '❓ Meaning Quiz';
        this.list = shuffle(pool()).slice(0, 10); this.i = 0; this.score = 0;
        announce('Meaning quiz started. 10 questions, 4 choices each. Streaks earn bonus coins!');
        this.ask();
    },
    ask() {
        if (this.i >= this.list.length) return this.finish();
        const w = this.list[this.i];
        const wrongs = shuffle(WORDS.filter(x => x.word !== w.word)).slice(0, 3);
        const opts = shuffle([w, ...wrongs]);
        setStatus(`Q ${this.i + 1}/10 · Score ${this.score}`);
        setStage(`<p class="progress-line">What does this word mean?</p>
            <p class="big-word" id="q-word">${esc(w.word)}</p>
            <div id="q-opts">` + opts.map(o => `<button class="opt" data-w="${esc(o.word)}">${esc(o.meaning)}</button>`).join('') + `</div>
            <div class="row"><button class="primary" id="q-hear">🔊 Hear word</button></div>
            <p class="progress-line" id="q-feed" role="status"></p>`);
        $('q-hear').onclick = () => say(w.word);
        say(`Question ${this.i + 1}. What does ${w.word} mean?`);
        document.querySelectorAll('#q-opts .opt').forEach(btn => btn.onclick = () => {
            const right = btn.dataset.w === w.word;
            document.querySelectorAll('#q-opts .opt').forEach(b => { b.disabled = true; if (b.dataset.w === w.word) b.classList.add('correct'); });
            if (right) {
                btn.classList.add('correct'); this.score++;
                rememberResult(w.word, true);
                const bonus = prog.streak >= 2 ? 5 : 0;
                addCoins(10 + bonus, 'correct answer'); bumpStreak(true); sfx('good');
                announce(`Correct! ${w.word} means: ${w.meaning}. ${bonus ? 'Streak bonus +5!' : ''}`, true);
                say(`Correct! ${w.word} means ${w.meaning}`);
            } else {
                btn.classList.add('wrong'); bumpStreak(false); rememberResult(w.word, false); sfx('bad');
                announce(`Not quite. ${w.word} actually means: ${w.meaning}. ${w.word} was added to your Review Deck.`, true);
                say(`The right answer is: ${w.meaning}`);
            }
            this.i++;
            setTimeout(() => this.ask(), 1900);
        });
    },
    finish() {
        prog.games++;
        let bonus = 0, msg = '';
        if (this.score === 10) { bonus = 50; msg = 'PERFECT score! Bonus +50 coins!'; }
        else if (this.score >= 8) { bonus = 25; msg = 'Great score! Bonus +25 coins!'; }
        if (bonus) addCoins(bonus, 'quiz bonus'); saveProg();
        setStage(`<p class="big-word">🏁 Quiz over</p>
            <p>You scored <strong>${this.score} / 10</strong>. ${msg}</p>
            <p class="coins-note">Wallet: 🪙 ${prog.coins} · ⭐ Level ${level()} · 🔥 best streak ${prog.bestStreak}</p>
            <div class="row"><button class="primary" id="q-restart">🔁 Play again</button><button class="primary" id="q-menu">← Menu</button></div>`);
        setStatus('');
        announce(`Quiz over. You scored ${this.score} out of 10. ${msg}`);
        say(`Quiz over. You scored ${this.score} out of 10. ${msg}`);
        $('q-restart').onclick = () => this.start();
        $('q-menu').onclick = showHome;
    }
};

// ---------------- Game 3: Spelling Bee ----------------
const bee = {
    list: [], i: 0, score: 0,
    start() {
        $('game-title').textContent = '🐝 Spelling Bee';
        this.list = shuffle(pool()).slice(0, 10); this.i = 0; this.score = 0;
        announce('Spelling bee started. I will speak a word — type its spelling. Use Hear again or the example as a hint.');
        this.ask();
    },
    ask() {
        if (this.i >= this.list.length) return this.finish();
        const w = this.list[this.i];
        setStatus(`Word ${this.i + 1}/10 · Score ${this.score}`);
        setStage(`<p class="progress-line">Listen carefully, then type the exact spelling.</p>
            <div class="row">
              <button class="primary" id="b-hear">🔊 Hear word</button>
              <button id="b-example">💡 Hear example</button>
              <button id="b-skip">⏭️ Skip</button>
            </div>
            <label class="progress-line" for="b-input">Your spelling (${w.word.length} letters):</label>
            <div class="row"><input type="text" id="b-input" autocomplete="off" spellcheck="false" maxlength="30"><button class="primary" id="b-submit">Check ✔️</button></div>
            <p class="progress-line" id="b-feed" role="status"></p>`);
        $('b-hear').onclick = () => say(w.word, true);
        $('b-example').onclick = () => say(w.example);
        $('b-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('b-submit').click(); } });
        $('b-submit').onclick = () => this.check();
        $('b-skip').onclick = () => { bumpStreak(false); announce(`Skipped. The word was ${w.word} — spelled: ${w.word.split('').join(' ')}`); this.i++; this.ask(); };
        $('b-input').focus();
        setTimeout(() => say(`Word ${this.i + 1}. ${w.word}`, true), 250);
    },
    check() {
        const w = this.list[this.i];
        const typed = $('b-input').value.trim().toLowerCase();
        if (!typed) { announce('Type your spelling first.', true); return; }
        if (typed === w.word.toLowerCase()) {
            this.score++;
            rememberResult(w.word, true);
            addCoins(Math.max(4, w.word.length), 'spelled correctly'); bumpStreak(true); sfx('good');
            announce(`Correct spelling! ${w.word}. Well done.`, true); say(`Correct! ${w.word}`);
            this.i++; setTimeout(() => this.ask(), 1300);
        } else {
            bumpStreak(false); rememberResult(w.word, false); sfx('bad');
            const letters = w.word.toUpperCase().split('').join(' ');
            announce(`Not quite. The correct spelling of ${w.word} is: ${letters}. It was added to your Review Deck.`, true);
            say(`The correct spelling is ${letters}`);
            $('b-feed').innerHTML = `❌ Correct spelling: <strong>${esc(w.word)}</strong> (${esc(w.meaning)})`;
            this.i++; setTimeout(() => this.ask(), 3200);
        }
    },
    finish() {
        prog.games++; saveProg();
        setStage(`<p class="big-word">🏆 Bee over!</p><p>You spelled <strong>${this.score} / 10</strong> words correctly.</p>
            <p class="coins-note">Wallet: 🪙 ${prog.coins} · ⭐ Level ${level()}</p>
            <div class="row"><button class="primary" id="b-restart">🔁 Play again</button><button class="primary" id="b-menu">← Menu</button></div>`);
        setStatus('');
        announce(`Spelling bee over. ${this.score} out of 10 correct.`);
        say(`Spelling bee over. You spelled ${this.score} of 10 correctly.`);
        $('b-restart').onclick = () => this.start();
        $('b-menu').onclick = showHome;
    }
};

// ---------------- Game 4: Word Chain vs AI ----------------
const chain = {
    used: [], lastLetter: '', over: false,
    start() {
        $('game-title').textContent = '⛓️ Word Chain vs AI';
        const opener = WORDS[Math.floor(Math.random() * WORDS.length)];
        this.used = [opener.word.toLowerCase()]; this.lastLetter = opener.word.slice(-1).toLowerCase(); this.over = false;
        announce(`Word chain started. The AI opened with "${opener.word}". Your word must start with the letter ${this.lastLetter.toUpperCase()}. Only words from the word bank count.`);
        this.render(`<p class="ai">🤖 AI: <strong>${esc(opener.word)}</strong> — ${esc(opener.meaning)}</p>`);
    },
    render(extraHtml) {
        const n = this.used.length;
        setStatus(`Chain length ${n} · need a word starting with “${this.lastLetter.toUpperCase()}”`);
        setStage(`<div class="chain-log" id="c-log" role="log" aria-label="Chain so far">${extraHtml || ''}</div>
            <label class="progress-line" for="c-input">Your word (starts with “${this.lastLetter.toUpperCase()}”):</label>
            <div class="row"><input type="text" id="c-input" autocomplete="off" spellcheck="false" maxlength="30"><button class="primary" id="c-play">Play ▶️</button><button id="c-giveup">🏳️ Give up</button></div>
            <p class="progress-line">Coins grow with chain length: longer chain = bigger reward when it ends.</p>`);
        $('c-play').onclick = () => this.play();
        $('c-giveup').onclick = () => this.end(false);
        $('c-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.play(); } });
        $('c-input').focus();
    },
    log(html) { const l = $('c-log'); if (l) l.insertAdjacentHTML('beforeend', html); },
    play() {
        if (this.over) return;
        const val = $('c-input').value.trim().toLowerCase();
        if (!val) return;
        const found = WORDS.find(w => w.word.toLowerCase() === val);
        if (!found) { announce(`"${val}" is not in the word bank. Try another word from the games you played.`, true); sfx('bad'); $('c-input').value = ''; return; }
        if (!val.startsWith(this.lastLetter)) { announce(`Your word must start with “${this.lastLetter.toUpperCase()}”.`, true); sfx('bad'); $('c-input').select(); return; }
        if (this.used.includes(val)) { announce(`"${val}" was already used in this chain. Pick a new one.`, true); sfx('bad'); $('c-input').value = ''; return; }
        this.used.push(val); this.lastLetter = val.slice(-1);
        this.log(`<p class="you">🧑 You: <strong>${esc(found.word)}</strong> — ${esc(found.meaning)}</p>`);
        announce(`You played ${found.word}. AI is thinking of a word starting with ${this.lastLetter.toUpperCase()}…`);
        // AI turn after a short, believable delay
        setTimeout(() => {
            if (this.over) return;
            const options = WORDS.filter(w => w.word.toLowerCase().startsWith(this.lastLetter) && !this.used.includes(w.word.toLowerCase()));
            if (!options.length) return this.end(true);
            const ai = options[Math.floor(Math.random() * options.length)];
            this.used.push(ai.word.toLowerCase()); this.lastLetter = ai.word.slice(-1);
            this.log(`<p class="ai">🤖 AI: <strong>${esc(ai.word)}</strong> — ${esc(ai.meaning)}</p>`);
            setStatus(`Chain length ${this.used.length} · need a word starting with “${this.lastLetter.toUpperCase()}”`);
            const inp = $('c-input'); if (inp) { inp.value = ''; inp.placeholder = `word starting with “${this.lastLetter.toUpperCase()}”…`; }
            const lbl = document.querySelector('label[for=c-input]'); if (lbl) lbl.textContent = `Your word (starts with “${this.lastLetter.toUpperCase()}”):`;
            sfx('flip');
            announce(`AI played ${ai.word}. Now you need a word starting with ${this.lastLetter.toUpperCase()}.`);
        }, 1100 + Math.random() * 900);
    },
    end(playerWon) {
        this.over = true; prog.games++;
        const len = this.used.length;
        let coins = Math.floor(len / 2) * 2;
        if (playerWon) coins += 50;
        bumpStreak(playerWon);
        if (coins) addCoins(coins, playerWon ? 'word chain victory!' : 'word chain effort'); else saveProg();
        sfx(playerWon ? 'coin' : 'bad');
        setStage(`<p class="big-word">${playerWon ? '🏆 You WIN!' : '🏁 Chain over'}</p>
            <p>${playerWon ? `The AI could not find a word starting with “${this.lastLetter.toUpperCase()}”. Brilliant!` : `Final chain length: <strong>${len}</strong> words.`}</p>
            <p class="coins-note">+${coins} 🪙 · Wallet ${prog.coins} · ⭐ Level ${level()}</p>
            <p class="progress-line">Words played: ${this.used.join(' → ')}</p>
            <div class="row"><button class="primary" id="c-restart">🔁 Play again</button><button class="primary" id="c-menu">← Menu</button></div>`);
        setStatus('');
        announce(playerWon ? `You won the word chain! ${coins} coins earned.` : `Chain over. ${coins} coins earned for a chain of ${len}.`);
        say(playerWon ? 'You win! Amazing vocabulary!' : `Chain over at ${len} words.`);
        $('c-restart').onclick = () => this.start();
        $('c-menu').onclick = showHome;
    }
};

// ---------------- Game 5: Review Deck (v2.0.0) ----------------
// Every word you missed in any game lands here. Clear the deck by proving
// you know each word; coins grow with the streak.
const review = {
    queue: [], i: 0, streak: 0,
    start() {
        $('game-title').textContent = '🔁 Review Deck';
        const words = (prog.review || []).map(k => WORDS.find(w => w.word.toLowerCase() === k)).filter(Boolean);
        this.queue = shuffle(words.length ? words : WORDS.slice(0, 10));
        this.i = 0; this.streak = 0;
        announce(`Review Deck. ${words.length ? words.length : 10} weak words to review. Hear the word, then choose Know or Again.`);
        this.ask();
    },
    ask() {
        if (this.i >= this.queue.length) return this.finish();
        const w = this.queue[this.i];
        setStatus(`Review ${this.i + 1} of ${this.queue.length} · streak ${this.streak}`);
        setStage(`<p class="progress-line">Reviewing a word you found hard. Listen, then try to recall its meaning.</p>
            <p class="big-word" id="r-word">${esc(w.word)}</p>
            <div class="row">
              <button class="primary" id="r-hear">🔊 Hear</button>
              <button class="primary" id="r-reveal">💡 Reveal meaning</button>
            </div>
            <div id="r-back" hidden>
              <p><strong>${esc(w.meaning)}</strong></p>
              <p class="telugu">తెలుగు: ${esc(w.telugu)}</p>
              <p class="example">“${esc(w.example)}”</p>
            </div>
            <div class="row" id="r-actions" hidden>
              <button class="primary" id="r-know">✅ I know it now</button>
              <button id="r-again">🔁 Still learning</button>
            </div>`);
        $('r-hear').onclick = () => say(w.word);
        $('r-reveal').onclick = () => {
            $('r-back').hidden = false; $('r-actions').hidden = false;
            sfx('flip');
            announce(`${w.word} means: ${w.meaning}. Telugu: ${w.telugu}`);
        };
        $('r-know').onclick = () => {
            rememberResult(w.word, true);
            this.streak++;
            addCoins(3 + Math.min(7, this.streak), 'review mastered');
            sfx('good'); this.i++; this.ask();
        };
        $('r-again').onclick = () => {
            rememberResult(w.word, false);
            sfx('bad'); this.i++; this.ask();
        };
        say(w.word);
    },
    finish() {
        prog.games++; saveProg();
        const remaining = (prog.review || []).length;
        setStage(`<p class="big-word">🎯 Review Deck done</p>
            <p>Remaining weak words: <strong>${remaining}</strong>. They stay in the deck until you master them.</p>
            <p class="coins-note">Wallet: 🪙 ${prog.coins} · ⭐ Level ${level()}</p>
            <div class="row"><button class="primary" id="r-restart">🔁 Review again</button><button class="primary" id="r-menu">← Menu</button></div>`);
        setStatus('');
        announce(remaining ? `Review complete. ${remaining} words still need practice.` : 'Review complete. Review Deck cleared — every word mastered!');
        say(remaining ? 'Review complete. Keep practising the remaining words.' : 'Amazing! You cleared your Review Deck.');
        $('r-restart').onclick = () => this.start();
        $('r-menu').onclick = showHome;
    }
};

// ---------------- Progress & stats (v2.0.0) ----------------
function showStats() {
    const knownCount = (prog.known || []).length;
    const total = prog.right + prog.wrong;
    const acc = total ? Math.round((prog.right / total) * 100) : 0;
    $('st-games').textContent = prog.games;
    $('st-known').textContent = knownCount;
    $('st-review').textContent = (prog.review || []).length;
    $('st-accuracy').textContent = total ? `${acc}% (${prog.right} right, ${prog.wrong} wrong)` : '—';
    $('st-best').textContent = `🔥 ${prog.bestStreak}`;
    $('st-bank').textContent = `${WORDS.length} words`;
    $('stats-modal').hidden = false;
}

const GAMES = { flashcards: flash, quiz, spelling: bee, chain, review };

// ---------------- settings ----------------
function applySettings() {
    document.documentElement.dataset.theme = settings.light ? 'light' : 'dark';
    document.documentElement.style.setProperty('--scale', settings.large ? 1.25 : 1);
    $('set-tts').checked = settings.tts; $('set-sounds').checked = settings.sounds;
    $('set-light').checked = settings.light; $('set-large').checked = settings.large;
    $('set-rate').value = settings.rate; $('rate-val').textContent = settings.rate.toFixed(1) + '×';
}
function bindSettings() {
    $('btn-settings').onclick = () => { $('settings-modal').hidden = false; };
    $('btn-close-settings').onclick = () => { $('settings-modal').hidden = true; saveSettings(); };
    $('set-tts').onchange = e => { settings.tts = e.target.checked; saveSettings(); announce(settings.tts ? 'Read aloud on.' : 'Read aloud off.'); };
    $('set-sounds').onchange = e => { settings.sounds = e.target.checked; saveSettings(); sfx('coin'); };
    $('set-light').onchange = e => { settings.light = e.target.checked; saveSettings(); applySettings(); };
    $('set-large').onchange = e => { settings.large = e.target.checked; saveSettings(); applySettings(); };
    $('set-rate').oninput = e => { settings.rate = parseFloat(e.target.value); $('rate-val').textContent = settings.rate.toFixed(1) + '×'; saveSettings(); };
    $('set-rate').onchange = () => say(`Speech speed ${settings.rate.toFixed(1)} times.`);
    $('btn-reset-prog').onclick = () => {
        if (!confirm('Reset all coins, XP and streaks?')) return;
        prog = Object.assign({}, defaults); saveProg(); renderWallet();
        announce('Progress reset. Fresh start — good luck!', true);
        $('settings-modal').hidden = true;
    };
}

// ---------------- daily bonus ----------------
function dailyBonus() {
    const today = new Date().toISOString().slice(0, 10);
    if (prog.lastDaily === today) return;
    prog.lastDaily = today; addCoins(25, 'daily bonus'); sfx('coin');
    $('btn-daily').disabled = true; $('btn-daily').textContent = '✅ Daily bonus claimed — come back tomorrow!';
}
function refreshDailyBtn() {
    const today = new Date().toISOString().slice(0, 10);
    if (prog.lastDaily === today) { $('btn-daily').disabled = true; $('btn-daily').textContent = '✅ Daily bonus claimed — come back tomorrow!'; }
}

// ---------------- boot ----------------
function init() {
    renderWallet(); applySettings(); bindSettings(); wotd(); refreshDailyBtn();
    document.querySelectorAll('.game-btn').forEach(b => b.onclick = () => startGame(b.dataset.game));
    $('btn-home').onclick = showHome;
    $('btn-daily').onclick = dailyBonus;
    $('btn-review').onclick = () => startGame('review');
    $('btn-stats').onclick = showStats;
    $('btn-close-stats').onclick = () => { $('stats-modal').hidden = true; };

    // v2.0.0 — automatic updates: a new service worker tells us when a fresh
    // version is cached; we announce it and offer an instant reload.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'WCU_APP_UPDATED') {
                const btn = $('btn-update');
                if (btn) btn.hidden = false;
                announce('A new version of Word Coach Ultra is ready. Tap Update to refresh.', true);
            }
        });
        $('btn-update').onclick = () => {
            const reg = () => navigator.serviceWorker.getRegistration().then(r => { if (r && r.waiting) r.waiting.postMessage({ type: 'WCU_SKIP_WAITING' }); });
            reg().then(() => setTimeout(() => location.reload(), 250));
        };
    }

    const reviewCount = (prog.review || []).length;
    announce(`Welcome to Word Coach Ultra. ${WORDS.length} words loaded across 3 levels. ${reviewCount ? `${reviewCount} words await review. ` : ''}Choose a game: Flashcards, Meaning Quiz, Spelling Bee, Word Chain, or Review Deck.`);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

window.WCU = { get prog() { return prog; }, GAMES, startGame, announce, showStats, WORDS };
})();
