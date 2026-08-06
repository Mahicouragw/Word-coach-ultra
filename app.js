/* ============================================================
   Word Coach Ultra v3.0 — Real Bilingual Dictionary Edition
   - Game appears IMMEDIATELY (no screenshot hiding)
   - Language selector: EN→TE, TE→EN, EN→EN, Mixed
   - Rich dictionary per word:
     meaning, Telugu, synonyms+sentences, antonyms+sentences,
     3-5 convo examples, 3-4 sentence explanation
   - After correct/wrong: banner + full dictionary card + next
   ============================================================ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const RAW = window.WORD_BANK || [];
console.log(`WORD_BANK raw: ${RAW.length}`);

// ---------- normalize to rich objects ----------
function fallbackSynAnt(word, meaning, telugu) {
  return {
    syn: [
      {en: `similar to ${word}`, te: telugu+' సమానం', sentence: `In conversation you can say this word is similar to ${word}.`, meaning: `Similar to ${word}`},
      {en: 'comparable', te: 'పోల్చదగిన', sentence: `This idea is comparable to ${word} in daily use.`, meaning: 'Almost same'}
    ],
    ant: [
      {en: `opposite of ${word}`, te: telugu+' వ్యతిరేకం', sentence: `The opposite situation is not ${word}.`, meaning: `Opposite of ${word}`},
      {en: 'different', te: 'వేరే', sentence: `This is different from ${word}.`, meaning: 'Not same'}
    ]
  };
}
function normalizeEntry(e) {
  if (Array.isArray(e)) {
    let [word, meaning, telugu, example, level] = e;
    const fb = fallbackSynAnt(word, meaning, telugu);
    return {
      w: word, pos: 'noun', meaning, telugu,
      teluguMeaning: `${telugu} - ${meaning}`,
      synonyms: fb.syn,
      antonyms: fb.ant,
      examples: [example, `I use the word ${word} in daily talk.`, `In Telugu, ${word} means ${telugu}.`],
      explanation: `The word '${word}' means ${meaning}. In Telugu it is '${telugu}'. It is useful in both exams and daily conversation. Try to use it in 2-3 sentences today.`,
      level: level||2
    };
  }
  // object already rich
  let o = e;
  // ensure fields
  o.w = o.w || o.word || '';
  if (!o.w) return null;
  o.pos = o.pos || 'noun';
  o.meaning = o.meaning || '';
  o.telugu = o.telugu || 'అర్థం';
  o.teluguMeaning = o.teluguMeaning || o.telugu;
  o.synonyms = o.synonyms || [];
  o.antonyms = o.antonyms || [];
  if (!o.synonyms.length) o.synonyms = fallbackSynAnt(o.w,o.meaning,o.telugu).syn;
  if (!o.antonyms.length) o.antonyms = fallbackSynAnt(o.w,o.meaning,o.telugu).ant;
  o.examples = o.examples || [o.example || `Example with ${o.w}.`];
  // ensure at least 3 examples
  while (o.examples.length < 3) o.examples.push(`Daily use: Try to say a sentence with ${o.w}.`);
  if (o.examples.length > 5) o.examples = o.examples.slice(0,5);
  o.explanation = o.explanation || `The word '${o.w}' means ${o.meaning}. In Telugu it means '${o.telugu}'. It appears in academic English and daily conversations. Use it when you want to express ${o.meaning.toLowerCase().split(';')[0]}.`;
  o.level = o.level || 2;
  return o;
}
const RICH = RAW.map(normalizeEntry).filter(Boolean);
console.log(`RICH normalized: ${RICH.length}`);
const WORDS = RICH; // alias for legacy

// ---------- rewards ----------
const KEY = 'wcu_progress_v1';
const defaults = { coins: 0, xp: 0, streak: 0, bestStreak: 0, lastDaily: '', games: 0, known: [], review: [], right: 0, wrong: 0 };
let prog = defaults;
try { prog = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e){}
const saveProg = () => localStorage.setItem(KEY, JSON.stringify(prog));
const level = () => 1 + Math.floor(prog.xp / 100);

function rememberResult(word, correct) {
  const key = word.toLowerCase();
  prog.right += correct ? 1 : 0;
  prog.wrong += correct ? 0 : 1;
  if (correct) {
    if (!prog.known.includes(key)) prog.known.push(key);
    prog.review = (prog.review||[]).filter(w=>w.toLowerCase()!==key);
  } else {
    if (!prog.review.includes(key)) prog.review.push(key);
  }
  if (prog.review.length > 100) prog.review = prog.review.slice(-100);
  saveProg();
}
function addCoins(n, why) {
  prog.coins += n; prog.xp += Math.max(0,n);
  saveProg(); renderWallet();
  if (n>0 && why) announce(`+${n} coins — ${why}. Total ${prog.coins}. Level ${level()}.`);
}
function bumpStreak(win) {
  prog.streak = win ? prog.streak+1 : 0;
  prog.bestStreak = Math.max(prog.bestStreak, prog.streak);
  saveProg(); renderWallet();
}
function renderWallet() {
  const c = $('w-coins'), l = $('w-level'), s = $('w-streak');
  if (c) c.textContent = `🪙 ${prog.coins}`;
  if (l) l.textContent = `⭐ Lv ${level()}`;
  if (s) s.textContent = `🔥 ${prog.streak}`;
}

// ---------- a11y + audio ----------
function announce(text, assertive) {
  const el = assertive ? $('aria-alert') : $('aria-log');
  if (!el) return;
  el.textContent=''; setTimeout(()=>{el.textContent=text;},30);
}
let settings = { tts: true, rate: 1.0, sounds: true, light: false, large: false };
try { settings = Object.assign(settings, JSON.parse(localStorage.getItem('wcu_settings_v1')||'{}')); } catch(e){}
const saveSettings = () => localStorage.setItem('wcu_settings_v1', JSON.stringify(settings));
let audioCtx=null;
const SFX_FILES = { good:'sounds/ui-good.ogg', bad:'sounds/ui-bad.ogg', coin:'sounds/ui-coin.ogg', flip:'sounds/ui-flip.ogg', click:'sounds/ui-click.ogg' };
const sfxCache={};
function sfx(kind) {
  if (!settings.sounds) return;
  const url = SFX_FILES[kind]||SFX_FILES.click;
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    if (audioCtx.state==='suspended') audioCtx.resume();
    const playCached = (buffer) => {
      const src = audioCtx.createBufferSource(); src.buffer=buffer;
      const g = audioCtx.createGain(); g.gain.value=0.5;
      src.connect(g).connect(audioCtx.destination); src.start(0);
    };
    if (sfxCache[url]) { playCached(sfxCache[url]); return; }
    fetch(url).then(r=>r.arrayBuffer()).then(b=>audioCtx.decodeAudioData(b)).then(d=>{sfxCache[url]=d; playCached(d);}).catch(()=>{});
  } catch(e){}
}
function cleanTTS(t){ return (t||'').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu,'').replace(/\s+/g,' ').trim(); }
function say(text, slow) {
  if (!settings.tts || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance==='undefined') return;
  try { speechSynthesis.cancel(); } catch(e){}
  const u = new SpeechSynthesisUtterance(cleanTTS(text).slice(0,800));
  u.rate = (settings.rate||1)*(slow?0.75:1);
  // prefer English voice
  try {
    const voices = speechSynthesis.getVoices();
    const en = voices.find(v=>v.lang && v.lang.toLowerCase().startsWith('en'));
    if (en) u.voice=en;
  } catch(e){}
  speechSynthesis.speak(u);
}
const shuffle = a => a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);
const esc = s => { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; };

// pool - all words for now (could filter by level in future)
const pool = () => RICH;

// lang mode
let langMode = localStorage.getItem('wcu_lang_v3') || 'mixed';
function setLangMode(m) {
  langMode = m;
  localStorage.setItem('wcu_lang_v3', m);
  document.querySelectorAll('.lang-pill').forEach(b=>{
    const active = b.dataset.lang===m;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active?'true':'false');
  });
  // if quiz active, restart to reflect
  if (currentGame==='quiz') quiz.start();
  announce(`Language mode: ${m}. ${m==='en-te'?'English to Telugu':m==='te-en'?'Telugu to English':m==='en-en'?'English to English':'Mixed English Telugu'}`);
}
function getQuestionType() {
  if (langMode==='mixed') {
    const arr=['en-en','en-te','te-en'];
    return arr[Math.floor(Math.random()*arr.length)];
  }
  return langMode;
}

// mode tabs
let currentGame='quiz';
let modeSet = localStorage.getItem('wcu_mode_v3') || 'quiz';
function setModeTab(m) {
  currentGame=m;
  modeSet=m;
  localStorage.setItem('wcu_mode_v3', m);
  document.querySelectorAll('.mode-tab').forEach(b=>{
    const active=b.dataset.mode===m;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active?'true':'false');
  });
  $('game-status').textContent='';
  const fa = $('feedback-area');
  if (fa) { fa.hidden=true; fa.innerHTML=''; }
  const titles = {quiz:'❓ Word Coach Quiz', dictionary:'📖 Real Dictionary', flashcards:'🃏 Flashcards', spelling:'🐝 Spelling Bee', chain:'⛓️ Word Chain vs AI', review:'🔁 Review Deck'};
  $('game-title').textContent = titles[m]||'Word Coach';
  if (m==='dictionary') {
    dictModeRender();
  } else {
    const g = GAMES[m];
    if (g) g.start();
  }
}

// ---------- dictionary card renderer ----------
function renderDictCard(obj, opts={}) {
  if (!obj) return '<p>No word selected.</p>';
  const synHtml = (obj.synonyms||[]).slice(0,3).map(s=>`
    <li>
      <b>${esc(s.en)}</b> <span class="telugu">(${esc(s.te||'')})</span><br>
      <small>${esc(s.meaning||'Synonym')}</small>
      <i>“${esc(s.sentence||'Example sentence with synonym.')}”</i>
    </li>
  `).join('') || '<li>No synonyms listed</li>';

  const antHtml = (obj.antonyms||[]).slice(0,3).map(a=>`
    <li>
      <b>${esc(a.en)}</b> <span class="telugu">(${esc(a.te||'')})</span><br>
      <small>${esc(a.meaning||'Antonym')}</small>
      <i>“${esc(a.sentence||'Example sentence with antonym.')}”</i>
    </li>
  `).join('') || '<li>No antonyms listed</li>';

  const examplesHtml = (obj.examples||[]).map((ex,i)=>`<li>${esc(ex)} ${i===0?' <span class="tl">(real use)</span>':''}</li>`).join('');

  const compact = opts.compact ? 'dict-card compact' : 'dict-card';

  return `
  <div class="${compact}" data-word="${esc(obj.w)}">
    <div class="dict-head">
      <h3 class="dict-word">${esc(obj.w)} <span class="pos">${esc(obj.pos)}</span> <button class="hbtn hear-btn" data-say="${esc(obj.w+'. '+obj.meaning)}" aria-label="Hear ${esc(obj.w)}">🔊</button></h3>
      <span class="level-badge">Lv ${obj.level||2} • Academic</span>
    </div>

    <div class="dict-section">
      <h4>📖 Meaning (English) — Word Meaning</h4>
      <p><strong>${esc(obj.meaning)}</strong></p>
    </div>

    <div class="dict-section telugu-section">
      <h4>🇮🇳 తెలుగు అర్థం — Telugu Meaning</h4>
      <p><strong class="telugu">${esc(obj.telugu)}</strong> — ${esc(obj.teluguMeaning)}</p>
    </div>

    <div class="dict-grid">
      <div class="dict-section">
        <h4>✅ Synonyms — పర్యాయపదాలు (with Telugu + sentence)</h4>
        <ul class="syn-list">${synHtml}</ul>
      </div>
      <div class="dict-section">
        <h4>❌ Antonyms — వ్యతిరేక పదాలు (with Telugu + sentence)</h4>
        <ul class="ant-list">${antHtml}</ul>
      </div>
    </div>

    <div class="dict-section">
      <h4>💬 Real Conversation Examples (3-5) — రోజువారీ వాక్యాలు</h4>
      <ol class="example-list">${examplesHtml}</ol>
    </div>

    <div class="dict-section explanation">
      <h4>🧠 How to use it naturally? (3-4 sentences) — ఎలా వాడాలి?</h4>
      <p>${esc(obj.explanation)}</p>
      <p style="margin-top:.5rem;color:var(--sub);font-size:.9rem">Tip: Use <b>${esc(obj.w)}</b> in Telugu conversation as <b class="telugu">${esc(obj.telugu)}</b> — e.g. “${esc(obj.examples[0]||'') }” — practice 3 times today!</p>
    </div>
  </div>
  `;
}

function attachHearButtons(root=document) {
  root.querySelectorAll('.hear-btn').forEach(btn=>{
    btn.onclick = () => {
      const txt = btn.dataset.say || btn.dataset.word || btn.textContent;
      say(txt);
      sfx('click');
    };
  });
}

function resultBannerHTML(isCorrect, obj, chosen, correct) {
  if (isCorrect) {
    return `<div class="result-banner correct">✅ Correct! Well done!<p>You rightly chose <b>${esc(correct)}</b> for <b>${esc(obj.w)}</b>. ${esc(obj.explanation.slice(0,160))}...</p></div>`;
  } else {
    return `<div class="result-banner wrong">❌ Wrong! Correct answer is <b>${esc(correct)}</b><p>You chose <b>${esc(chosen)}</b>. The word <b>${esc(obj.w)}</b> actually means <b>${esc(obj.meaning)}</b> — Telugu <b class="telugu">${esc(obj.telugu)}</b>. Don't worry, review the full dictionary below and it will go to your Review Deck.</p></div>`;
  }
}

// ---------- navigation ----------
function setStage(html) { $('game-stage').innerHTML = html; }
function setStatus(t) { $('game-status').textContent = t; }

// ---------- Word of the Day ----------
function wotd() {
  const today = new Date();
  const seed = today.getFullYear()*10000 + (today.getMonth()+1)*100 + today.getDate();
  const w = RICH[seed % RICH.length];
  $('wotd-word').textContent = w.w;
  const posEl = $('wotd-pos'); if(posEl) posEl.textContent = w.pos;
  $('wotd-meaning').textContent = w.meaning;
  const teEl = $('wotd-telugu'); if(teEl) teEl.textContent = `తెలుగు: ${w.telugu} — ${w.teluguMeaning}`;
  const synant = $('wotd-synant');
  if (synant) {
    synant.innerHTML = `
      <span>✅ ${esc(w.synonyms[0]?.en||'synonym')}</span>
      <span>❌ ${esc(w.antonyms[0]?.en||'antonym')}</span>
    `;
  }
  $('wotd-example').textContent = `“${w.examples[0]}”`;
  const hearBtn = $('wotd-hear');
  if (hearBtn) hearBtn.onclick = () => { say(`${w.w}. ${w.meaning}. Telugu: ${w.telugu}. Example: ${w.examples[0]}. Synonym: ${w.synonyms[0]?.en}. Antonym: ${w.antonyms[0]?.en}. ${w.explanation}`); sfx('click'); };
  const moreBtn = $('wotd-more');
  if (moreBtn) moreBtn.onclick = () => {
    const fa = $('feedback-area');
    fa.hidden=false; fa.innerHTML = renderDictCard(w) + `<button class="next-btn" id="wotd-next">Continue Quiz →</button>`;
    attachHearButtons(fa);
    const nb = $('wotd-next'); if(nb) nb.onclick=()=>{fa.hidden=true; quiz.start();};
    fa.scrollIntoView({behavior:'smooth'});
  };
}

// ---------- Game: Coach Quiz (main, appears immediately) ----------
const quiz = {
  queue: [], idx:0, score:0, current:null, currentType:null, correctText:'', options:[],
  start() {
    currentGame='quiz';
    this.queue = shuffle(pool());
    this.idx=0; this.score=0;
    setStatus(`Coaching • ${this.queue.length} words • ${langMode}`);
    announce(`Word Coach Quiz started. Language mode ${langMode}. I will ask meaning with full dictionary feedback after each answer.`, true);
    this.next();
  },
  next() {
    if (this.idx >= this.queue.length) return this.finish();
    this.current = this.queue[this.idx];
    this.currentType = getQuestionType();
    const {correctText, options} = this.makeOptions(this.current, this.currentType);
    this.correctText = correctText;
    this.options = options;
    this.render();
  },
  makeOptions(current, type) {
    let correct='', wrongs=[], poolWords = RICH.filter(r=>r.w.toLowerCase()!==current.w.toLowerCase());
    // avoid duplicates
    const uniq = arr => Array.from(new Set(arr));
    if (type==='en-en') {
      correct = current.meaning;
      wrongs = shuffle(poolWords).slice(0,12).map(r=>r.meaning);
      wrongs = uniq(wrongs).filter(t=>t!==correct).slice(0,3);
    } else if (type==='en-te') {
      correct = current.teluguMeaning;
      wrongs = shuffle(poolWords).slice(0,12).map(r=>r.teluguMeaning);
      wrongs = uniq(wrongs).filter(t=>t!==correct).slice(0,3);
    } else { // te-en
      correct = current.w;
      wrongs = shuffle(poolWords).slice(0,12).map(r=>r.w);
      wrongs = uniq(wrongs).filter(t=>t.toLowerCase()!==correct.toLowerCase()).slice(0,3);
    }
    // if not enough, fill
    while (wrongs.length < 3) wrongs.push(poolWords[wrongs.length % poolWords.length].meaning || 'sample option');
    const opts = shuffle([{text: correct, isCorrect:true}, ...wrongs.map(t=>({text:t, isCorrect:false}))]);
    return {correctText: correct, options: opts};
  },
  render() {
    const cur = this.current;
    const type = this.currentType;
    let prompt='', qDisplay='', sub='';
    if (type==='en-en') {
      prompt='What does this word mean? (English definition)';
      qDisplay=cur.w;
      sub=`Pos: ${cur.pos} • Telugu: ${cur.telugu}`;
    } else if (type==='en-te') {
      prompt='What is Telugu meaning? — తెలుగు అర్థం ఏమిటి?';
      qDisplay=cur.w;
      sub=`English: ${cur.meaning} • ${cur.pos}`;
    } else {
      prompt='What is English word for this Telugu? — ఈ తెలుగు పదానికి English ఏమిటి?';
      qDisplay=cur.telugu;
      sub=`Telugu Meaning: ${cur.teluguMeaning} • Hint: English meaning is "${cur.meaning}"`;
    }
    setStatus(`Q ${this.idx+1}/${this.queue.length} • Score ${this.score} • ${type.toUpperCase()} • 🔥 ${prog.streak}`);
    setStage(`
      <p class="question-prompt">${esc(prompt)}</p>
      <p class="big-word" id="q-word">${esc(qDisplay)}</p>
      <p class="telugu progress-line" id="q-sub">${esc(sub)}</p>
      <div id="q-opts">
        ${this.options.map(o=>`<button class="opt" data-correct="${o.isCorrect}" data-text="${esc(o.text).replace(/"/g,'&quot;')}">${esc(o.text)}</button>`).join('')}
      </div>
      <div class="row" style="margin-top:.6rem">
        <button class="secondary" id="q-hear">🔊 Hear word + meaning</button>
        <button class="secondary" id="q-skip">⏭️ Skip to dictionary</button>
      </div>
      <p class="progress-line">Tip: After you answer, you will see ✅/❌ + full dictionary with synonyms, antonyms, 3-5 examples, 3-4 sentence explanation.</p>
    `);
    $('q-hear').onclick = () => {
      if (type==='te-en') say(`${cur.telugu}. English word ${cur.w}. ${cur.meaning}`);
      else say(`${cur.w}. ${cur.meaning}. Telugu ${cur.telugu}. Example ${cur.examples[0]}`);
      sfx('click');
    };
    $('q-skip').onclick = () => {
      const fa=$('feedback-area');
      fa.hidden=false;
      fa.innerHTML = `<div class="result-banner" style="background:var(--panel3)">📖 Dictionary for <b>${esc(cur.w)}</b></div>` + renderDictCard(cur) + `<button class="next-btn" id="q-next">Next word →</button>`;
      attachHearButtons(fa);
      $('q-next').onclick=()=>{ this.idx++; this.next(); fa.hidden=true; };
      // do not count as wrong
    };
    document.querySelectorAll('#q-opts .opt').forEach(btn=>{
      btn.onclick = () => this.answer(btn);
    });
    // speak question automatically
    if (type==='te-en') say(`Telugu word: ${cur.telugu}. What is English?`, true);
    else say(`What does ${cur.w} mean?`, true);
    $('btn-hear-q').onclick = () => $('q-hear').click();
  },
  answer(btn) {
    const isCorrect = btn.dataset.correct === 'true';
    const chosen = btn.dataset.text;
    const cur = this.current;
    // disable all
    document.querySelectorAll('#q-opts .opt').forEach(b=>{
      b.disabled=true;
      if (b.dataset.correct==='true') b.classList.add('correct');
    });
    if (isCorrect) {
      btn.classList.add('correct');
      this.score++;
      rememberResult(cur.w, true);
      const bonus = prog.streak>=2?5:0;
      addCoins(10+bonus, 'correct answer');
      bumpStreak(true);
      sfx('good');
      announce(`Correct! ${cur.w} means ${cur.meaning}. Telugu ${cur.telugu}.`, true);
      say(`Correct! ${cur.w} means ${cur.meaning}.`);
    } else {
      btn.classList.add('wrong');
      bumpStreak(false);
      rememberResult(cur.w, false);
      sfx('bad');
      announce(`Wrong. Correct is ${this.correctText}. ${cur.w} means ${cur.meaning}. Added to Review Deck.`, true);
      say(`Wrong. Correct is ${cur.meaning}.`);
    }

    // show feedback area with result banner + full dict card
    const fa=$('feedback-area');
    fa.hidden=false;
    const banner = resultBannerHTML(isCorrect, cur, chosen, this.correctText);
    fa.innerHTML = banner + renderDictCard(cur) + `<button class="next-btn" id="q-next">${isCorrect?'Next word → 🎯':'Got it, next →'}</button>`;
    attachHearButtons(fa);
    fa.scrollIntoView({behavior:'smooth', block:'start'});

    $('q-next').onclick = () => {
      fa.hidden=true;
      this.idx++;
      setTimeout(()=>this.next(), 120);
    };
  },
  finish() {
    prog.games++; saveProg();
    let msg='', bonus=0;
    if (this.score===this.queue.length) { bonus=50; msg='PERFECT! Bonus +50'; }
    else if (this.score>=this.queue.length*0.8) { bonus=25; msg='Great job! Bonus +25'; }
    if (bonus) addCoins(bonus,'quiz bonus');
    setStage(`
      <p class="big-word">🏁 Coaching complete!</p>
      <p>You scored <strong>${this.score} / ${this.queue.length}</strong>. ${msg}</p>
      <p class="coins-note">Wallet: 🪙 ${prog.coins} • ⭐ Level ${level()} • 🔥 Best ${prog.bestStreak}</p>
      <p class="progress-line">Every wrong word is saved in Review Deck. Search any word above in dictionary.</p>
      <div class="row"><button class="primary" id="q-restart">🔁 New coaching set</button><button class="secondary" id="q-review">🔁 Go to Review Deck</button></div>
    `);
    setStatus('');
    announce(`Quiz over. Score ${this.score} out of ${this.queue.length}. ${msg}`);
    say(`Coaching over. Score ${this.score} of ${this.queue.length}. ${msg}`);
    $('q-restart').onclick=()=>this.start();
    const rev=$('q-review'); if(rev) rev.onclick=()=>setModeTab('review');
  }
};

// ---------- flashcards ----------
const flash = {
  queue:[], card:null, flipped:false, knownCount:0,
  start() {
    this.queue=shuffle(pool()); this.knownCount=0; this.flipped=false;
    const total=this.queue.length;
    setStatus(`Flashcards • ${total} words • ${langMode}`);
    announce(`${total} flashcards. Flip for full dictionary.`);
    this.next();
  },
  next() {
    if (!this.queue.length) return this.finish();
    this.card=this.queue[0]; this.flipped=false;
    setStatus(`Card ${this.knownCount+1} • ${this.queue.length} left`);
    setStage(`
      <div class="flash-card">
        <p class="big-word" id="fc-word">${esc(this.card.w)}</p>
        <p class="telugu">${esc(this.card.telugu)} — ${esc(this.card.pos)}</p>
        <div id="fc-back" hidden>${renderDictCard(this.card)}</div>
      </div>
      <div class="row">
        <button class="primary" id="fc-hear">🔊 Hear</button>
        <button class="primary" id="fc-flip">📖 Show full dictionary</button>
        <button id="fc-know" hidden>✅ I know ( +2 🪙)</button>
        <button id="fc-again" hidden>🔁 Again (review)</button>
      </div>
    `);
    attachHearButtons(document);
    $('fc-hear').onclick=()=>say(`${this.card.w}. ${this.card.meaning}. Telugu ${this.card.telugu}. ${this.card.examples[0]}`);
    $('fc-flip').onclick=()=>{
      this.flipped=!this.flipped;
      $('fc-back').hidden=!this.flipped;
      $('fc-know').hidden=$('fc-again').hidden=!this.flipped;
      sfx('flip');
      if (this.flipped) announce(`${this.card.w} means ${this.card.meaning}. Telugu ${this.card.telugu}. Synonyms ${this.card.synonyms.map(s=>s.en).join(', ')}. Antonym ${this.card.antonyms[0]?.en}`);
    };
    $('fc-know').onclick=()=>{ this.queue.shift(); this.knownCount++; rememberResult(this.card.w,true); addCoins(2,'flashcard known'); sfx('coin'); this.next(); };
    $('fc-again').onclick=()=>{ const c=this.queue.shift(); this.queue.splice(Math.min(3,this.queue.length),0,c); rememberResult(c.w,false); announce(`${c.w} saved to Review Deck.`); this.next(); };
    say(this.card.w);
  },
  finish() {
    prog.games++; saveProg();
    setStage(`<p class="big-word">🎉 Deck complete!</p><p>Coins 🪙 ${prog.coins} • Level ${level()}</p><div class="row"><button class="primary" id="fc-restart">🔁 New deck</button><button class="secondary" id="fc-quiz">❓ Quiz now</button></div>`);
    setStatus('');
    $('fc-restart').onclick=()=>this.start();
    const q=$('fc-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

// ---------- spelling ----------
const bee = {
  list:[], i:0, score:0,
  start() {
    this.list=shuffle(pool()).slice(0,12); this.i=0; this.score=0;
    announce('Spelling bee. Listen and type. After answer see full dictionary.');
    this.ask();
  },
  ask() {
    if (this.i>=this.list.length) return this.finish();
    const w=this.list[this.i];
    setStatus(`Spelling ${this.i+1}/${this.list.length} • Score ${this.score}`);
    setStage(`
      <p class="question-prompt">Listen and type exact spelling. Then see dictionary.</p>
      <p class="big-word">${esc(w.w)} has ${w.w.length} letters</p>
      <div class="row"><button class="primary" id="b-hear">🔊 Hear word (slow)</button><button class="secondary" id="b-example">💡 Hear example</button><button class="secondary" id="b-skip">⏭️ Skip</button></div>
      <div class="row"><input type="text" id="b-input" placeholder="Type spelling..." autocomplete="off" spellcheck="false" maxlength="40"><button class="primary" id="b-submit">Check ✔️</button></div>
      <p class="progress-line" id="b-feed" role="status"></p>
    `);
    $('b-hear').onclick=()=>say(w.w,true);
    $('b-example').onclick=()=>say(w.examples[0]);
    $('b-input').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $('b-submit').click(); }});
    $('b-submit').onclick=()=>this.check();
    $('b-skip').onclick=()=>{ bumpStreak(false); announce(`Skipped ${w.w} spelled ${w.w.split('').join(' ')}`); this.i++; this.ask(); };
    $('b-input').focus();
    setTimeout(()=>say(`Word ${this.i+1}. ${w.w}`,true),300);
  },
  check() {
    const w=this.list[this.i];
    const typed=$('b-input').value.trim().toLowerCase();
    if (!typed) { announce('Type spelling first.',true); return; }
    const fa=$('feedback-area'); fa.hidden=false;
    if (typed===w.w.toLowerCase()) {
      this.score++; rememberResult(w.w,true); addCoins(Math.max(4,w.w.length),'spelled correctly'); bumpStreak(true); sfx('good');
      fa.innerHTML = `<div class="result-banner correct">✅ Correct spelling! ${esc(w.w)}</div>` + renderDictCard(w) + `<button class="next-btn" id="b-next">Next spelling →</button>`;
      announce(`Correct spelling ${w.w}.`,true); say(`Correct! ${w.w}`);
    } else {
      bumpStreak(false); rememberResult(w.w,false); sfx('bad');
      const letters=w.w.toUpperCase().split('').join(' ');
      fa.innerHTML = `<div class="result-banner wrong">❌ Not quite. Correct: <b>${esc(w.w)}</b> (${esc(letters)})</div>` + renderDictCard(w) + `<button class="next-btn" id="b-next">Next →</button>`;
      announce(`Wrong spelling. Correct ${w.w} is ${letters}.`,true); say(`Correct spelling is ${letters}`);
    }
    attachHearButtons(fa);
    $('b-next').onclick=()=>{ fa.hidden=true; this.i++; this.ask(); };
  },
  finish() {
    prog.games++; saveProg();
    setStage(`<p class="big-word">🏆 Bee over!</p><p>Score ${this.score}/${this.list.length}</p><p class="coins-note">Wallet 🪙 ${prog.coins} • Level ${level()}</p><div class="row"><button class="primary" id="b-restart">🔁 Again</button><button class="secondary" id="b-quiz">❓ Quiz</button></div>`);
    setStatus('');
    $('b-restart').onclick=()=>this.start();
    const q=$('b-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

// ---------- word chain ----------
const chain = {
  used:[], lastLetter:'', over:false,
  start() {
    const opener = RICH[Math.floor(Math.random()*RICH.length)];
    this.used=[opener.w.toLowerCase()]; this.lastLetter=opener.w.slice(-1).toLowerCase(); this.over=false;
    setStatus(`Chain length ${this.used.length} • Need “${this.lastLetter.toUpperCase()}”`);
    announce(`Word chain started. AI opened with ${opener.w}. Need ${this.lastLetter.toUpperCase()}.`);
    const html = `<div class="chain-log" id="c-log"><p class="ai">🤖 AI: <strong>${esc(opener.w)}</strong> — ${esc(opener.meaning)} <em class="telugu">(${esc(opener.telugu)})</em></p></div>
      <label class="progress-line" for="c-input">Your word starts with “${this.lastLetter.toUpperCase()}”:</label>
      <div class="row"><input type="text" id="c-input" placeholder="word starting with ${this.lastLetter.toUpperCase()}…"><button class="primary" id="c-play">Play ▶️</button><button class="secondary" id="c-giveup">🏳️ Give up</button></div>
      <p class="progress-line">Only words from ${RICH.length} word bank count. After each move see dictionary.</p>
      <div id="c-dict"></div>`;
    setStage(html);
    this.bind();
  },
  bind() {
    const inp=$('c-input');
    if (!inp) return;
    $('c-play').onclick=()=>this.play();
    $('c-giveup').onclick=()=>this.end(false);
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); this.play(); }});
    inp.focus();
  },
  log(html){ const l=$('c-log'); if(l) l.insertAdjacentHTML('beforeend', html); },
  play() {
    if (this.over) return;
    const val=$('c-input').value.trim().toLowerCase();
    if (!val) return;
    const found=RICH.find(w=>w.w.toLowerCase()===val);
    if (!found){ announce(`${val} not in bank. Try known words.`,true); sfx('bad'); $('c-input').value=''; return; }
    if (!val.startsWith(this.lastLetter)){ announce(`Must start with ${this.lastLetter.toUpperCase()}.`,true); sfx('bad'); $('c-input').select(); return; }
    if (this.used.includes(val)){ announce(`${val} already used.`,true); sfx('bad'); $('c-input').value=''; return; }
    this.used.push(val); this.lastLetter=val.slice(-1);
    this.log(`<p class="you">🧑 You: <strong>${esc(found.w)}</strong> — ${esc(found.meaning)} <span class="telugu">${esc(found.telugu)}</span></p>`);
    const dictDiv=$('c-dict'); if(dictDiv){ dictDiv.innerHTML=renderDictCard(found); attachHearButtons(dictDiv); }
    announce(`You played ${found.w}. AI thinking ${this.lastLetter.toUpperCase()}…`);
    setTimeout(()=>{
      if (this.over) return;
      const options=RICH.filter(w=>w.w.toLowerCase().startsWith(this.lastLetter) && !this.used.includes(w.w.toLowerCase()));
      if (!options.length) return this.end(true);
      const ai=options[Math.floor(Math.random()*options.length)];
      this.used.push(ai.w.toLowerCase()); this.lastLetter=ai.w.slice(-1);
      this.log(`<p class="ai">🤖 AI: <strong>${esc(ai.w)}</strong> — ${esc(ai.meaning)} <em class="telugu">${esc(ai.telugu)}</em></p>`);
      setStatus(`Chain ${this.used.length} • Need “${this.lastLetter.toUpperCase()}”`);
      const inp=$('c-input'); if(inp){ inp.value=''; inp.placeholder=`word starting with “${this.lastLetter.toUpperCase()}”…`; }
      const lbl=document.querySelector('label[for=c-input]'); if(lbl) lbl.textContent=`Your word (starts with “${this.lastLetter.toUpperCase()}”):`;
      sfx('flip');
    }, 1100+Math.random()*600);
  },
  end(playerWon) {
    this.over=true; prog.games++;
    const len=this.used.length; let coins=Math.floor(len/2)*2; if(playerWon) coins+=50;
    bumpStreak(playerWon); if(coins) addCoins(coins, playerWon?'chain victory!':'chain effort'); else saveProg();
    sfx(playerWon?'coin':'bad');
    const fa=$('feedback-area'); fa.hidden=false;
    fa.innerHTML=`<div class="result-banner ${playerWon?'correct':'wrong'}">${playerWon?'🏆 You WIN! AI stuck!':'🏁 Chain over'} <p>Chain: ${esc(this.used.join(' → '))}<br>+${coins} 🪙</p></div><button class="next-btn" id="c-restart">🔁 Play again</button><button class="secondary" id="c-menu">❓ Quiz</button>`;
    setStatus('');
    $('c-restart').onclick=()=>{ fa.hidden=true; this.start(); };
    const qm=$('c-menu'); if(qm) qm.onclick=()=>{ fa.hidden=true; setModeTab('quiz'); };
  }
};

// ---------- review deck ----------
const review = {
  queue:[], i:0, streak:0,
  start() {
    const words=(prog.review||[]).map(k=>RICH.find(w=>w.w.toLowerCase()===k)).filter(Boolean);
    this.queue=shuffle(words.length?words:RICH.slice(0,12));
    this.i=0; this.streak=0;
    setStatus(`Review ${this.queue.length} weak words`);
    announce(`Review Deck ${words.length?words.length:12} words.`);
    this.ask();
  },
  ask() {
    if (this.i>=this.queue.length) return this.finish();
    const w=this.queue[this.i];
    setStatus(`Review ${this.i+1}/${this.queue.length} • streak ${this.streak}`);
    setStage(`
      <p class="question-prompt">Review weak word - full dictionary will show after reveal</p>
      <p class="big-word" id="r-word">${esc(w.w)}</p>
      <p class="telugu">${esc(w.telugu)} • ${esc(w.pos)}</p>
      <div class="row"><button class="primary" id="r-hear">🔊 Hear</button><button class="primary" id="r-reveal">💡 Show dictionary</button></div>
      <div id="r-back" hidden>${renderDictCard(w)}</div>
      <div class="row" id="r-actions" hidden><button class="primary" id="r-know">✅ I know it now</button><button class="secondary" id="r-again">🔁 Still learning</button></div>
    `);
    attachHearButtons(document);
    $('r-hear').onclick=()=>say(w.w);
    $('r-reveal').onclick=()=>{
      $('r-back').hidden=false; $('r-actions').hidden=false; sfx('flip');
      announce(`${w.w} means ${w.meaning}. Telugu ${w.telugu}.`);
    };
    $('r-know').onclick=()=>{ rememberResult(w.w,true); this.streak++; addCoins(3+Math.min(7,this.streak),'review mastered'); sfx('good'); this.i++; this.ask(); };
    $('r-again').onclick=()=>{ rememberResult(w.w,false); sfx('bad'); this.i++; this.ask(); };
    say(w.w);
  },
  finish() {
    prog.games++; saveProg();
    const remaining=(prog.review||[]).length;
    setStage(`<p class="big-word">🎯 Review done</p><p>Remaining weak: <strong>${remaining}</strong></p><p class="coins-note">Wallet 🪙 ${prog.coins} • ⭐ Level ${level()}</p><div class="row"><button class="primary" id="r-restart">🔁 Review again</button><button class="secondary" id="r-quiz">❓ Quiz</button></div>`);
    setStatus('');
    $('r-restart').onclick=()=>this.start();
    const q=$('r-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

// ---------- dictionary mode ----------
function dictModeRender() {
  const query = ($('dict-input')?.value||'').trim();
  if (!query) {
    setStage(`
      <p class="big-word">📖 Real Dictionary — ${RICH.length} words</p>
      <p class="progress-line">Search above: English or తెలుగు. Each entry shows:</p>
      <ul class="progress-line" style="margin-left:1rem">
        <li>📖 Word meaning (English)</li>
        <li>🇮🇳 Telugu meaning</li>
        <li>✅ Synonyms with Telugu + sentence (synonym sentence)</li>
        <li>❌ Antonyms with Telugu + sentence (antonym sentences)</li>
        <li>💬 3-5 real conversation examples</li>
        <li>🧠 3-4 sentence explanation how to use naturally</li>
      </ul>
      <p>Try searching: <b>benevolent, fiscal, empathy, sustainable</b> or Telugu <b>విజ్ఞానం, కృషి</b></p>
      <div class="row">${shuffle(RICH).slice(0,8).map(w=>`<button class="secondary dict-quick" data-w="${esc(w.w)}">${esc(w.w)} • ${esc(w.telugu)}</button>`).join('')}</div>
      <div id="dict-full"></div>
    `);
    document.querySelectorAll('.dict-quick').forEach(b=>{
      b.onclick=()=>{ $('dict-input').value=b.dataset.w; handleDictSearch(); };
    });
  } else {
    handleDictSearch();
  }
  setStatus(`Dictionary • ${RICH.length} entries • Language: ${langMode}`);
}

function handleDictSearch() {
  const input = $('dict-input');
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const resultsEl = $('dict-results');
  const stage = $('game-stage');
  if (!q || q.length<1) {
    if (resultsEl) resultsEl.innerHTML='';
    if (currentGame==='dictionary') dictModeRender();
    return;
  }
  const filtered = RICH.filter(o=>{
    const hay = `${o.w} ${o.telugu} ${o.teluguMeaning} ${o.meaning} ${o.synonyms.map(s=>s.en).join(' ')} ${o.antonyms.map(a=>a.en).join(' ')}`.toLowerCase();
    return hay.includes(q);
  }).slice(0,30);
  if (resultsEl) {
    resultsEl.innerHTML = filtered.length ? filtered.map(o=>`
      <button class="dict-hit" data-w="${esc(o.w)}" role="option">
        <b>${esc(o.w)} <span style="font-weight:400;color:var(--sub)">[${esc(o.pos)}]</span> — <span class="telugu">${esc(o.telugu)}</span></b>
        <small>${esc(o.meaning.slice(0,90))}… | ${esc(o.teluguMeaning.slice(0,60))}</small>
      </button>
    `).join('') : `<p class="progress-line">No results for “${esc(q)}”. Try English or Telugu.</p>`;
    resultsEl.querySelectorAll('.dict-hit').forEach(btn=>{
      btn.onclick=()=>{
        const wobj = RICH.find(r=>r.w===btn.dataset.w);
        if (!wobj) return;
        showDictResult(wobj);
      };
    });
  }
  if (currentGame==='dictionary' && filtered.length) {
    // auto show first result in stage if query exact
    const exact = filtered.find(o=>o.w.toLowerCase()===q || o.telugu===q);
    if (exact) showDictResult(exact);
  }
}

function showDictResult(wobj) {
  const fa = $('feedback-area');
  const stage = $('game-stage');
  const dictFull = $('dict-full');
  if (currentGame==='dictionary') {
    if (dictFull) {
      dictFull.innerHTML = renderDictCard(wobj);
      attachHearButtons(dictFull);
      dictFull.scrollIntoView({behavior:'smooth'});
    } else if (stage) {
      stage.innerHTML = renderDictCard(wobj) + `<div class="row"><button class="primary" id="dict-quiz">❓ Quiz this word</button><button class="secondary" id="dict-clear2">Clear</button></div>`;
      attachHearButtons(stage);
      const qBtn=$('dict-quiz'); if(qBtn) qBtn.onclick=()=>{ quiz.queue=[wobj, ...shuffle(pool()).slice(0,9)]; quiz.idx=0; quiz.score=0; quiz.current=wobj; setModeTab('quiz'); quiz.next(); };
      const cBtn=$('dict-clear2'); if(cBtn) cBtn.onclick=()=>{ $('dict-input').value=''; $('dict-results').innerHTML=''; dictModeRender(); };
      say(`${wobj.w}. ${wobj.meaning}. Telugu ${wobj.telugu}.`);
    }
  } else {
    if (fa) {
      fa.hidden=false;
      fa.innerHTML = `<div class="result-banner" style="background:var(--panel3);border-color:var(--accent3)">📖 Dictionary view: ${esc(wobj.w)}</div>` + renderDictCard(wobj) + `<button class="next-btn" id="dict-close">Close dictionary</button>`;
      attachHearButtons(fa);
      const closeBtn=$('dict-close'); if(closeBtn) closeBtn.onclick=()=>{ fa.hidden=true; };
    }
  }
}

const GAMES = {quiz, flashcards:flash, spelling:bee, chain, review, dictionary:{start:dictModeRender}};

// ---------- settings ----------
function applySettings() {
  document.documentElement.dataset.theme = settings.light ? 'light' : 'dark';
  document.documentElement.style.setProperty('--scale', settings.large ? 1.25 : 1);
  const ttsEl=$('set-tts'); if(ttsEl) ttsEl.checked=settings.tts;
  const sndEl=$('set-sounds'); if(sndEl) sndEl.checked=settings.sounds;
  const lightEl=$('set-light'); if(lightEl) lightEl.checked=settings.light;
  const largeEl=$('set-large'); if(largeEl) largeEl.checked=settings.large;
  const rateEl=$('set-rate'); if(rateEl) rateEl.value=settings.rate;
  const rateVal=$('rate-val'); if(rateVal) rateVal.textContent=settings.rate.toFixed(1)+'×';
}
function bindSettings() {
  const btnSet=$('btn-settings'); if(btnSet) btnSet.onclick=()=>{ $('settings-modal').hidden=false; };
  const btnClose=$('btn-close-settings'); if(btnClose) btnClose.onclick=()=>{ $('settings-modal').hidden=true; saveSettings(); };
  const setTts=$('set-tts'); if(setTts) setTts.onchange=e=>{ settings.tts=e.target.checked; saveSettings(); announce(settings.tts?'Read aloud on':'Read aloud off'); };
  const setSounds=$('set-sounds'); if(setSounds) setSounds.onchange=e=>{ settings.sounds=e.target.checked; saveSettings(); sfx('coin'); };
  const setLight=$('set-light'); if(setLight) setLight.onchange=e=>{ settings.light=e.target.checked; saveSettings(); applySettings(); };
  const setLarge=$('set-large'); if(setLarge) setLarge.onchange=e=>{ settings.large=e.target.checked; saveSettings(); applySettings(); };
  const setRate=$('set-rate'); if(setRate) {
    setRate.oninput=e=>{ settings.rate=parseFloat(e.target.value); const rv=$('rate-val'); if(rv) rv.textContent=settings.rate.toFixed(1)+'×'; saveSettings(); };
    setRate.onchange=()=>say(`Speech speed ${settings.rate.toFixed(1)} times.`);
  }
  const btnReset=$('btn-reset-prog'); if(btnReset) btnReset.onclick=()=>{
    if (!confirm('Reset coins, XP, streaks?')) return;
    prog=Object.assign({}, defaults); saveProg(); renderWallet();
    announce('Progress reset.',true); $('settings-modal').hidden=true;
  };
}

// ---------- stats ----------
function updateStats() {
  const knownCount=(prog.known||[]).length;
  const total=prog.right+prog.wrong;
  const acc=total?Math.round((prog.right/total)*100):0;
  const elGames=$('st-games'); if(elGames) elGames.textContent=prog.games;
  const elKnown=$('st-known'); if(elKnown) elKnown.textContent=knownCount;
  const elReview=$('st-review'); if(elReview) elReview.textContent=(prog.review||[]).length;
  const elAcc=$('st-accuracy'); if(elAcc) elAcc.textContent= total? `${acc}% (${prog.right}✓/${prog.wrong}✗)` : '—';
  const elBest=$('st-best'); if(elBest) elBest.textContent=`🔥 ${prog.bestStreak}`;
  const elBank=$('st-bank'); if(elBank) elBank.textContent=`${RICH.length} words`;
}

// ---------- daily bonus ----------
function dailyBonus() {
  const today=new Date().toISOString().slice(0,10);
  if (prog.lastDaily===today) return;
  prog.lastDaily=today; addCoins(25,'daily bonus'); sfx('coin');
  const btn=$('btn-daily'); if(btn){ btn.disabled=true; btn.textContent='✅ Daily claimed — come tomorrow!'; }
  updateStats();
}
function refreshDailyBtn() {
  const today=new Date().toISOString().slice(0,10);
  const btn=$('btn-daily');
  if (!btn) return;
  if (prog.lastDaily===today){ btn.disabled=true; btn.textContent='✅ Daily claimed — come tomorrow!'; }
}

// ---------- bind UI ----------
function bindLangBar() {
  document.querySelectorAll('.lang-pill').forEach(b=>{
    b.onclick=()=>setLangMode(b.dataset.lang);
  });
  setLangMode(langMode);
}
function bindModeTabs() {
  document.querySelectorAll('.mode-tab').forEach(b=>{
    b.onclick=()=>setModeTab(b.dataset.mode);
  });
  setModeTab(modeSet);
}
function bindDictSearch() {
  const input=$('dict-input');
  const clear=$('dict-clear');
  const hear=$('btn-hear-search');
  if (input) {
    input.addEventListener('input', ()=>{
      handleDictSearch();
      if (currentGame!=='dictionary' && input.value.trim().length>=2) {
        // show quick results only via results box, no auto switch
      }
    });
    input.addEventListener('keydown', e=>{
      if (e.key==='Enter') {
        e.preventDefault();
        const q=input.value.trim().toLowerCase();
        const exact=RICH.find(o=>o.w.toLowerCase()===q || o.telugu===q);
        if (exact) showDictResult(exact);
      }
    });
  }
  if (clear) clear.onclick=()=>{
    if (input) input.value='';
    const res=$('dict-results'); if(res) res.innerHTML='';
    if (currentGame==='dictionary') dictModeRender();
  };
  if (hear) hear.onclick=()=>{
    const q=input?.value||'';
    if (q) say(q);
    else say('Type a word to hear');
  };
}

// ---------- boot ----------
function init() {
  renderWallet();
  applySettings();
  bindSettings();
  bindLangBar();
  bindModeTabs();
  bindDictSearch();
  wotd();
  refreshDailyBtn();
  updateStats();
  const btnDaily=$('btn-daily'); if(btnDaily) btnDaily.onclick=dailyBonus;

  // auto-start quiz immediately — game appears, no screenshot disappearing
  if (modeSet!=='dictionary') {
    // quiz already started via setModeTab, but ensure visible
    if (currentGame==='quiz' && quiz.queue.length===0) quiz.start();
  } else {
    dictModeRender();
  }

  // service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
    navigator.serviceWorker.addEventListener('message', e=>{
      if (e.data && e.data.type==='WCU_APP_UPDATED') {
        const btn=$('btn-update'); if(btn) btn.hidden=false;
        announce('New version ready. Tap Update.',true);
      }
    });
    const updBtn=$('btn-update');
    if (updBtn) updBtn.onclick=()=>{
      navigator.serviceWorker.getRegistration().then(r=>{ if(r&&r.waiting) r.waiting.postMessage({type:'WCU_SKIP_WAITING'}); });
      setTimeout(()=>location.reload(),250);
    };
  }

  const reviewCount=(prog.review||[]).length;
  announce(`Welcome to Word Coach Ultra. Real dictionary with ${RICH.length} academic words, English to Telugu and Telugu to English. Game appears immediately. ${reviewCount?reviewCount+' words in review.':''} Choose language and start coaching.`, true);

  // periodic stats update
  setInterval(updateStats, 3000);
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

window.WCU = { RICH, WORDS: RICH, GAMES, setModeTab, setLangMode, renderDictCard, quiz };
})();
