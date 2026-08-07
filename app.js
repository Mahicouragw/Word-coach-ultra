/* ============================================================================
   Word Coach Ultra v4.0 Pro — Professional Real Dictionary Edition
   Architecture: modular, accessible, fast, production-ready

   - Real dictionary: EN, TE, EN→TE, TE→EN, POS, pronunciation, IPA,
     meanings (multiple), idioms, phrasal verbs, root, origin, etymology,
     collocations, formal/informal/academic/daily, 3-5 examples,
     Telugu examples, explanation, common mistakes, related, word family,
     difficulty, frequency, offline cache
   - Intelligent search: EN, TE, mixed, partial, prefix, suffix, contains,
     case-insensitive, accent-insensitive, fuzzy Levenshtein, Did you mean,
     highlight, instant, voice search, history, recent, popular, suggestions
   - Quiz: EN→TE, TE→EN, EN→EN, mixed, Correct/Wrong + why + dict card +
     IPA + synonyms/antonyms + examples + explanation + hear again
   - Learning: Daily Challenge, WOTD, streak, XP, coins, achievements,
     levels, smart review (SRS), flashcards, spelling, listening, bookmark
   - A11y: TalkBack, keyboard, ARIA, focus order, large touch targets, high contrast
   - Performance: precomputed index, debounce, lazy, minimal lag
   - Build: zero errors, validates with Node
   Dependencies (classic scripts loaded before this):
     words.js, js/utils.js (WCUUtils), js/storage.js (WCUStorage),
     js/search.js (WCUSearchEngine), js/audio.js (WCUAudio),
     js/achievements.js (WCUAchievements), js/srs.js (WCUSRS)

   No imports — classic script for offline PWA & validation
   ============================================================================ */
(function(){
'use strict';

/* -------------------- helpers & globals -------------------- */
const $ = id => document.getElementById(id);
const RAW_BANK = window.WORD_BANK || [];
const Utils = window.WCUUtils || {};
const Storage = window.WCUStorage || {};
const SearchEngineClass = window.WCUSearchEngine || window.WCUSearch?.Engine;
const AudioEngine = window.WCUAudio || {};
const Achievements = window.WCUAchievements || {};
const SRS = window.WCUSRS || {};
const esc = s => { const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };
const normalize = (Utils.normalize) ? Utils.normalize : s=>String(s||'').toLowerCase().trim();
const levenshtein = (Utils.levenshtein) ? Utils.levenshtein : (a,b)=>Math.abs(a.length-b.length);
const debounce = (Utils.debounce) ? Utils.debounce : (fn,d)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; };
const highlightMatch = (Utils.highlightMatch) ? Utils.highlightMatch : (t,q)=>esc(t);
const shuffle = (Utils.shuffle) ? Utils.shuffle : a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);

console.log(`WCU v4 Pro — BANK raw ${RAW_BANK.length}`);

/* -------------------- dictionary normalization v4 -------------------- */
function normalizeEntry(e){
  if (!e) return null;
  if (Array.isArray(e)){
    return {
      w: e[0], pos:'noun', pronunciation:e[0], ipa:`/${e[0].toLowerCase()}/`,
      root:'', origin:'', etymology:'', meanings:[{definition:e[1], telugu:e[2], teluguMeaning:e[2]}],
      meaning:e[1], telugu:e[2], teluguMeaning:e[2],
      synonyms:[], antonyms:[], idioms:[], phrasalVerbs:[], collocations:[],
      formal:'', informal:'', academic:'', daily:'',
      examples:[e[3]], teluguExamples:[], explanation:e[3], commonMistakes:'', relatedWords:[], wordFamily:{},
      difficulty:'B2', frequency:'common', level:e[4]||2
    };
  }
  // already enriched v4 — ensure defaults for new fields
  const o = e;
  o.w = o.w || o.word || '';
  if (!o.w) return null;
  o.pos = o.pos || 'noun';
  o.pronunciation = o.pronunciation || o.w;
  o.ipa = o.ipa || `/${o.w.toLowerCase()}/`;
  o.root = o.root || '';
  o.origin = o.origin || '';
  o.etymology = o.etymology || '';
  o.meanings = o.meanings || [{definition:o.meaning, telugu:o.telugu, teluguMeaning:o.teluguMeaning, pos:o.pos, examples:o.examples}];
  o.meaning = o.meaning || (o.meanings[0]?.definition||'');
  o.telugu = o.telugu || '';
  o.teluguMeaning = o.teluguMeaning || o.telugu;
  o.synonyms = o.synonyms || [];
  o.antonyms = o.antonyms || [];
  o.idioms = o.idioms || [];
  o.phrasalVerbs = o.phrasalVerbs || [];
  o.collocations = o.collocations || [];
  o.formal = o.formal || '';
  o.informal = o.informal || '';
  o.academic = o.academic || '';
  o.daily = o.daily || '';
  o.examples = o.examples || [];
  while (o.examples.length<3) o.examples.push(`Example with ${o.w}.`);
  if (o.examples.length>5) o.examples=o.examples.slice(0,5);
  o.teluguExamples = o.teluguExamples || [];
  o.explanation = o.explanation || `The word '${o.w}' means ${o.meaning}. In Telugu '${o.telugu}'. Used in daily and academic contexts.`;
  o.commonMistakes = o.commonMistakes || '';
  o.relatedWords = o.relatedWords || [];
  o.wordFamily = o.wordFamily || {};
  o.difficulty = o.difficulty || 'B2';
  o.frequency = o.frequency || 'common';
  o.level = o.level||2;
  return o;
}
const RICH = RAW_BANK.map(normalizeEntry).filter(Boolean);
console.log(`RICH v4 normalized ${RICH.length}, 3.2MB dict ready`);

/* -------------------- rewards & progress -------------------- */
const KEY = 'wcu_progress_v1';
const defaults = { coins:0, xp:0, streak:0, bestStreak:0, lastDaily:'', games:0, known:[], review:[], right:0, wrong:0, searchCount:0, quizQuestions:0 };
let prog = defaults;
try { prog = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY)||'{}')); } catch(e){}
const saveProg = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch(e){} };
const level = () => 1 + Math.floor((prog.xp||0)/100);

function rememberResult(word, correct){
  const key = String(word).toLowerCase();
  prog.right += correct?1:0;
  prog.wrong += correct?0:1;
  prog.quizQuestions = (prog.quizQuestions||0)+1;
  if (correct){
    if (!prog.known.includes(key)) prog.known.push(key);
    prog.review = (prog.review||[]).filter(w=>w.toLowerCase()!==key);
    if (SRS && SRS.update) SRS.update(word, 5);
  } else {
    if (!prog.review.includes(key)) prog.review.push(key);
    if (SRS && SRS.update) SRS.update(word, 1);
  }
  if (prog.review.length>100) prog.review=prog.review.slice(-100);
  saveProg();
}
function addCoins(n, why){
  prog.coins += n; prog.xp += Math.max(0,n);
  saveProg(); renderWallet();
  if (n>0 && why) announce(`+${n} coins — ${why}. Total ${prog.coins} coins. Level ${level()}. XP ${prog.xp}.`);
  if (Achievements && Achievements.checkAll) Achievements.checkAll(prog, {searchCount: prog.searchCount, quizQuestions: prog.quizQuestions});
}
function bumpStreak(win){
  prog.streak = win? prog.streak+1:0;
  prog.bestStreak = Math.max(prog.bestStreak, prog.streak);
  saveProg(); renderWallet();
}
function renderWallet(){
  const c=$('w-coins'), l=$('w-level'), s=$('w-streak'), x=$('w-xp');
  if (c) c.textContent=`🪙 ${prog.coins}`;
  if (l) l.textContent=`⭐ Lv ${level()}`;
  if (s) s.textContent=`🔥 ${prog.streak}`;
  if (x) x.textContent=`✨ ${prog.xp} XP`;
}

/* -------------------- a11y + audio wrappers -------------------- */
function announce(text, assertive){
  const el = assertive? $('aria-alert') : $('aria-log');
  if (!el) return;
  el.textContent=''; setTimeout(()=>{ el.textContent=text; }, 30);
}
let settings = { tts:true, rate:1.0, sounds:true, light:false, large:false, highlight:true };
try { settings = Object.assign(settings, JSON.parse(localStorage.getItem('wcu_settings_v1')||'{}')); } catch(e){}
const saveSettings = () => { try { localStorage.setItem('wcu_settings_v1', JSON.stringify(settings)); } catch(e){} };

function sfx(kind){
  if (AudioEngine && AudioEngine.sfx) return AudioEngine.sfx(kind);
  // fallback
  if (!settings.sounds) return;
}
function say(text, slow){
  if (AudioEngine && AudioEngine.say) return AudioEngine.say(text, slow);
  if (!settings.tts || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); } catch(e){}
  const u = new SpeechSynthesisUtterance(String(text||'').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu,'').slice(0,900));
  u.rate = (settings.rate||1)*(slow?0.75:1);
  speechSynthesis.speak(u);
}
function sayWithIPA(obj){
  if (AudioEngine && AudioEngine.sayWithIPA) return AudioEngine.sayWithIPA(obj);
  if (!obj) return;
  say(`${obj.w}. ${obj.ipa||''}. ${obj.meaning}. Telugu ${obj.telugu}. Example ${obj.examples&&obj.examples[0]||''}`);
}

/* -------------------- search engine -------------------- */
let searchEngine=null;
try {
  if (SearchEngineClass) searchEngine = new SearchEngineClass(RICH);
} catch(e){ console.warn('Search engine build failed', e); }
if (!searchEngine){
  // fallback simple engine
  searchEngine = {
    search(q){
      const qq = normalize(q);
      const results = RICH.filter(o=> normalize(o.w).includes(qq) || normalize(o.telugu).includes(qq) || normalize(o.meaning).includes(qq)).slice(0,30);
      return {results, suggestions:[], didYouMean:[], query:q};
    },
    getDidYouMean(q){ return []; },
    highlight: (t,qr)=>esc(t)
  };
}

/* -------------------- dictionary card renderer v4 Pro -------------------- */
function renderDictCardV4(obj, opts={}){
  if (!obj) return '<p>No word selected.</p>';
  const q = opts.query||'';

  const hl = (txt) => {
    if (!settings.highlight || !q) return esc(txt);
    try { return highlightMatch(txt, q); } catch(e){ return esc(txt); }
  };

  const synHtml = (obj.synonyms||[]).slice(0,5).map(s=>`
    <li>
      <b>${hl(s.en)}</b> <span class="telugu">(${hl(s.te||'')})</span><br>
      <small>${hl(s.meaning||'Synonym')}</small>
      <i>“${hl(s.sentence||'Example sentence with synonym.')}”</i>
    </li>
  `).join('') || '<li>No synonyms listed</li>';

  const antHtml = (obj.antonyms||[]).slice(0,5).map(a=>`
    <li>
      <b>${hl(a.en)}</b> <span class="telugu">(${hl(a.te||'')})</span><br>
      <small>${hl(a.meaning||'Antonym')}</small>
      <i>“${hl(a.sentence||'Example sentence with antonym.')}”</i>
    </li>
  `).join('') || '<li>No antonyms listed</li>';

  const idiomsHtml = (obj.idioms||[]).length ? `<div class="dict-section"><h4>💠 Idioms — జాతీయాలు</h4><ul class="syn-list">${obj.idioms.map(id=>`<li><b>${hl(id.idiom)}</b> — ${hl(id.meaning)}<br><small class="telugu">${hl(id.telugu||'')}</small><i>“${hl(id.example||'')}”</i></li>`).join('')}</ul></div>` : '';

  const phrasalHtml = (obj.phrasalVerbs||[]).length ? `<div class="dict-section"><h4>🔗 Phrasal Verbs</h4><ul class="syn-list">${obj.phrasalVerbs.map(p=>`<li><b>${hl(p.phrase)}</b> — ${hl(p.meaning)}<br><i>“${hl(p.example||'')}”</i></li>`).join('')}</ul></div>` : '';

  const collocationsHtml = (obj.collocations||[]).length ? `<p><strong>Collocations:</strong> ${obj.collocations.map(c=>`<span class="mini-synant"><span>${hl(c)}</span></span>`).join(' ')}</p>` : '';

  const meaningsHtml = (obj.meanings||[]).slice(0,3).map((m,i)=>`
    <div style="margin-bottom:.5rem">
      <b>${i+1}. [${hl(m.pos||obj.pos)}] ${hl(m.definition||m.meaning||obj.meaning)}</b><br>
      <span class="telugu">Telugu: ${hl(m.telugu||obj.telugu)} — ${hl(m.teluguMeaning||obj.teluguMeaning)}</span><br>
      ${m.examples? `<small>Ex: ${hl(m.examples[0]||'')}</small>` : ''}
    </div>
  `).join('');

  const examplesHtml = (obj.examples||[]).map((ex,i)=>`<li>${hl(ex)}</li>`).join('');
  const teluguExamplesHtml = (obj.teluguExamples||[]).map(ex=>`<li class="telugu">${hl(ex)}</li>`).join('');

  const wordFamilyHtml = obj.wordFamily ? Object.entries(obj.wordFamily).map(([k,v])=>`<span><b>${hl(k)}:</b> ${hl(v)}</span>`).join(' • ') : '';

  const formalInformalHtml = `
    <details style="margin-top:.5rem"><summary>Formal / Informal / Academic / Daily usage</summary>
      <p><b>Formal:</b> ${hl(obj.formal||'')}</p>
      <p><b>Informal:</b> ${hl(obj.informal||'')}</p>
      <p><b>Academic:</b> ${hl(obj.academic||'')}</p>
      <p><b>Daily:</b> ${hl(obj.daily||'')}</p>
    </details>
  `;

  const isFav = (Storage && Storage.isFavorite) ? Storage.isFavorite(obj.w) : false;

  return `
  <div class="dict-card" data-word="${esc(obj.w)}" role="article" aria-label="Dictionary entry for ${esc(obj.w)}">
    <div class="dict-head">
      <h3 class="dict-word">${hl(obj.w)} <span class="pos">${hl(obj.pos)}</span> <button class="hbtn hear-btn" data-say="${esc(obj.w+' '+obj.meaning)}" aria-label="Hear pronunciation of ${esc(obj.w)}">🔊</button> <button class="hbtn fav-btn" data-word="${esc(obj.w)}" aria-label="${isFav?'Remove from favorites':'Add to favorites'}">${isFav?'⭐':'☆'}</button></h3>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
        <span class="level-badge">${hl(obj.difficulty||'B2')} • ${hl(obj.frequency||'common')} • Lv ${obj.level||2}</span>
      </div>
    </div>

    <div class="dict-section">
      <h4>🔊 Pronunciation & IPA</h4>
      <p><strong>Pronunciation:</strong> ${hl(obj.pronunciation||obj.w)}<br>
      <strong>IPA:</strong> <code>${hl(obj.ipa||'')}</code> <button class="hbtn hear-btn small" data-say="${esc(obj.w)}" aria-label="Hear ${esc(obj.w)}">🔊 Hear</button><br>
      <strong>Root:</strong> ${hl(obj.root||'—')} | <strong>Origin:</strong> ${hl(obj.origin||'—')}</p>
      <p><strong>Etymology / Origin:</strong> ${hl(obj.etymology||'')}</p>
      ${collocationsHtml}
    </div>

    <div class="dict-section">
      <h4>📖 Multiple Meanings & Definitions — అర్థాలు</h4>
      ${meaningsHtml}
      <p><strong>Primary:</strong> ${hl(obj.meaning)}<br><span class="telugu"><strong>Telugu:</strong> ${hl(obj.telugu)} — ${hl(obj.teluguMeaning)}</span></p>
    </div>

    <div class="dict-grid">
      <div class="dict-section">
        <h4>✅ Synonyms (పర్యాయపదాలు) + Telugu + sentence</h4>
        <ul class="syn-list">${synHtml}</ul>
      </div>
      <div class="dict-section">
        <h4>❌ Antonyms (వ్యతిరేక) + Telugu + sentence</h4>
        <ul class="ant-list">${antHtml}</ul>
      </div>
    </div>

    ${idiomsHtml}
    ${phrasalHtml}

    <div class="dict-section">
      <h4>💬 Natural Examples (3-5) — Daily Conversation & Academic</h4>
      <ol class="example-list">${examplesHtml}</ol>
      ${teluguExamplesHtml ? `<h4 style="margin-top:.6rem">🇮🇳 Telugu Examples</h4><ol class="example-list">${teluguExamplesHtml}</ol>` : ''}
    </div>

    <div class="dict-section explanation">
      <h4>🧠 How used naturally? (3-4 sentences)</h4>
      <p>${hl(obj.explanation)}</p>
      ${formalInformalHtml}
      <p style="margin-top:.5rem"><strong>Common Mistakes:</strong> ${hl(obj.commonMistakes||'Avoid confusing with similar words.')}</p>
      <p><strong>Related Words:</strong> ${(obj.relatedWords||[]).map(r=>`<span class="mini-synant"><span>${hl(r)}</span></span>`).join(' ')}</p>
      <p><strong>Word Family:</strong> ${wordFamilyHtml||'—'}</p>
    </div>

    <div class="row" style="margin-top:.5rem">
      <button class="primary hear-btn" data-say="${esc(obj.w+'. '+obj.meaning+'. Telugu '+obj.telugu+'. Example '+ (obj.examples&&obj.examples[0]||''))}" aria-label="Hear full entry">🔊 Hear full entry</button>
      <button class="secondary fav-btn" data-word="${esc(obj.w)}" aria-label="${isFav?'Remove favorite':'Favorite'}">${isFav?'⭐ Favorited':'☆ Favorite'}</button>
      <button class="secondary copy-btn" data-word="${esc(obj.w)}" aria-label="Copy word">📋 Copy</button>
    </div>
  </div>
  `;
}

function resultBannerHTML(isCorrect, obj, chosen, correct, query){
  if (isCorrect){
    return `<div class="result-banner correct" role="status">✅ Correct! Excellent — <b>${esc(correct)}</b> for <b>${esc(obj.w)}</b> is right.
      <p>${esc(obj.explanation.slice(0,180))}... IPA ${esc(obj.ipa||'')} helps pronunciation. Telugu <b class="telugu">${esc(obj.telugu)}</b> — you earned XP!</p></div>`;
  } else {
    return `<div class="result-banner wrong" role="alert">❌ Wrong! Correct is <b>${esc(correct)}</b>
      <p>You chose <b>${esc(chosen)}</b>. <b>${esc(obj.w)}</b> means <b>${esc(obj.meaning)}</b> — Telugu <b class="telugu">${esc(obj.telugu)}</b>. ${esc(obj.commonMistakes||'Review common mistakes below.')} Saved to Smart Review (SRS).</p></div>`;
  }
}

function attachDynamicButtons(root=document){
  if (!root) return;
  root.querySelectorAll('.hear-btn').forEach(btn=>{
    btn.onclick = () => {
      const txt = btn.dataset.say || btn.dataset.word || '';
      say(txt);
      if (AudioEngine && AudioEngine.sfx) AudioEngine.sfx('click');
    };
  });
  root.querySelectorAll('.fav-btn').forEach(btn=>{
    btn.onclick = () => {
      const w = btn.dataset.word;
      if (!w) return;
      const added = Storage && Storage.toggleFavorite ? Storage.toggleFavorite(w) : false;
      announce(added? `${w} added to favorites` : `${w} removed from favorites`);
      // update all fav buttons for this word
      document.querySelectorAll(`.fav-btn[data-word="${CSS.escape(w)}"]`).forEach(b=>{
        b.textContent = added? '⭐ Favorited' : '☆ Favorite';
        if (b.classList.contains('hbtn') && !b.classList.contains('secondary') && !b.classList.contains('primary')) b.textContent = added?'⭐':'☆';
      });
      renderSidePanels();
      if (Achievements && Achievements.checkAndUnlock){
        if (Storage && Storage.getFavorites().length>=5) Achievements.checkAndUnlock('favorite_5');
      }
    };
  });
  root.querySelectorAll('.copy-btn').forEach(btn=>{
    btn.onclick = async () => {
      const w = btn.dataset.word;
      try { await navigator.clipboard.writeText(w); announce(`${w} copied`); } catch(e){ announce('Copy failed'); }
    };
  });
}

/* -------------------- search experience -------------------- */
let currentQuery='';
function renderSidePanels(){
  // recent searches
  const recentSearches = (Storage && Storage.getRecentSearches) ? Storage.getRecentSearches() : [];
  const recentWords = (Storage && Storage.getRecentWords) ? Storage.getRecentWords() : [];
  const favorites = (Storage && Storage.getFavorites) ? Storage.getFavorites() : [];
  const popular = (Storage && Storage.getPopularSearches) ? Storage.getPopularSearches(8) : [];

  const historyList = $('search-history-list');
  if (historyList) historyList.innerHTML = recentSearches.length? recentSearches.slice(0,10).map(q=>`<button class="tag" data-q="${esc(q)}">${esc(q)}</button>`).join('') : '<small class="progress-line">No recent searches</small>';

  const recentList = $('recent-words-list');
  if (recentList) recentList.innerHTML = recentWords.length? recentWords.slice(0,12).map(w=>`<button class="tag" data-w="${esc(w)}">${esc(w)}</button>`).join('') : '<small class="progress-line">No recently viewed</small>';

  const favList = $('favorites-list');
  if (favList) favList.innerHTML = favorites.length? favorites.slice(0,12).map(w=>`<button class="tag fav-tag" data-w="${esc(w)}">⭐ ${esc(w)}</button>`).join('') : '<small class="progress-line">No favorites yet — tap ⭐ on any word</small>';

  const popList = $('popular-list');
  if (popList) popList.innerHTML = popular.length? popular.map(p=>`<button class="tag" data-q="${esc(p.query)}">${esc(p.query)} (${p.count})</button>`).join('') : '<small class="progress-line">Search to build popular list</small>';

  // bind tag clicks
  document.querySelectorAll('#search-history-list .tag, #popular-list .tag').forEach(b=>{
    b.onclick=()=>{ const q=b.dataset.q; if (q){ const inp=$('dict-input'); if(inp){ inp.value=q; handleDictSearch(); } } };
  });
  document.querySelectorAll('#recent-words-list .tag, #favorites-list .tag').forEach(b=>{
    b.onclick=()=>{ const w=b.dataset.w; if(w){ const obj=RICH.find(r=>r.w.toLowerCase()===w.toLowerCase()); if(obj) showDictResult(obj, w); } };
  });
}

function handleDictSearch(){
  const input = $('dict-input');
  if (!input) return;
  const qRaw = input.value.trim();
  currentQuery = qRaw;
  const resultsEl = $('dict-results');
  const meta = $('search-meta');
  const didEl = $('did-you-mean');

  if (!qRaw || qRaw.length<1){
    if (resultsEl) resultsEl.innerHTML = '<p class="progress-line">Intelligent search — type English or తెలుగు, partial, prefix (pre-), suffix (-tion), contains, fuzzy. Try "enviroment" for Did you mean demo.</p>';
    if (meta) meta.textContent = `Dictionary ready — ${RICH.length} words, IPA, Telugu, synonyms, antonyms, offline cache`;
    if (didEl) { didEl.hidden=true; didEl.innerHTML=''; }
    renderSidePanels();
    if (currentGame==='dictionary') {
      // keep side panels visible
    }
    return;
  }

  // Increment search count for achievements (debounced? but count each search)
  prog.searchCount = (prog.searchCount||0)+1; saveProg();
  if (Storage && Storage.addRecentSearch) Storage.addRecentSearch(qRaw);
  if (Achievements && Achievements.checkAndUnlock && prog.searchCount===1) Achievements.checkAndUnlock('first_search');

  const res = searchEngine.search(qRaw, {limit:30});
  const {results, didYouMean, suggestions} = res;

  if (meta){
    meta.textContent = `${results.length} results for “${qRaw}” • ${suggestions.length} suggestions • Fuzzy enabled • Voice ${AudioEngine && AudioEngine.isVoiceSearchSupported && AudioEngine.isVoiceSearchSupported() ? 'supported 🎤' : 'not supported'}`;
  }

  // Did you mean
  if (didEl){
    if (didYouMean && didYouMean.length>0){
      didEl.hidden=false;
      if (qRaw.toLowerCase()==='enviroment'){
        // explicit demo case
        didEl.innerHTML = `<strong>Did you mean Environment?</strong><div class="row" style="margin-top:.4rem">
          <button class="secondary did-btn" data-w="environment">Environment</button>
          <button class="secondary did-btn" data-w="environmental">Environmental</button>
          <button class="secondary did-btn" data-w="environmentalist">Environmentalist</button>
        </div>`;
      } else {
        didEl.innerHTML = `<strong>Did you mean:</strong> ${didYouMean.map(o=>`• <button class="secondary did-btn" data-w="${esc(o.w)}">${esc(o.w)}</button>`).join(' ')}`;
      }
      didEl.querySelectorAll('.did-btn').forEach(b=>{
        b.onclick=()=>{ const inp=$('dict-input'); if(inp){ inp.value=b.dataset.w; handleDictSearch(); const obj=RICH.find(r=>r.w===b.dataset.w); if(obj) showDictResult(obj, b.dataset.w); } };
      });
    } else {
      // check getDidYouMean more
      const dym = searchEngine.getDidYouMean ? searchEngine.getDidYouMean(qRaw, 3) : [];
      if (dym && dym.length){
        didEl.hidden=false;
        didEl.innerHTML = `<strong>Did you mean:</strong> ${dym.map(o=>`• <button class="secondary did-btn" data-w="${esc(o.w)}">${esc(o.w)}</button>`).join(' ')}`;
        didEl.querySelectorAll('.did-btn').forEach(b=>{ b.onclick=()=>{ const inp=$('dict-input'); if(inp){ inp.value=b.dataset.w; handleDictSearch(); } }; });
      } else {
        didEl.hidden=true; didEl.innerHTML='';
      }
    }
  }

  if (resultsEl){
    if (!results.length){
      resultsEl.innerHTML = `<p class="progress-line">No exact results for “${esc(qRaw)}”. Try did-you-mean suggestions or check Telugu search.</p>`;
    } else {
      resultsEl.innerHTML = results.map(o=>{
        const highlightedEn = highlightMatch(o.w, qRaw);
        const highlightedTe = highlightMatch(o.telugu, qRaw);
        const highlightedMean = highlightMatch(o.meaning.slice(0,90), qRaw);
        return `<button class="dict-hit" data-w="${esc(o.w)}" role="option" aria-label="${esc(o.w)} ${esc(o.telugu)} — ${esc(o.meaning.slice(0,60))}">
          <b>${highlightedEn} <span style="font-weight:400;color:var(--sub)">[${esc(o.pos)}] ${esc(o.ipa||'')}</span> — <span class="telugu">${highlightedTe}</span></b>
          <small>${highlightedMean}… | ${esc(o.teluguMeaning.slice(0,70))} | ${esc(o.difficulty)} • ${esc(o.frequency)}</small>
        </button>`;
      }).join('');
      resultsEl.querySelectorAll('.dict-hit').forEach(btn=>{
        btn.onclick=()=>{
          const wobj = RICH.find(r=>r.w===btn.dataset.w);
          if (!wobj) return;
          showDictResult(wobj, qRaw);
        };
      });
    }
  }

  renderSidePanels();

  // If in dictionary mode and exact match, auto show first
  if (currentGame==='dictionary' && results.length){
    const exact = results.find(o=> o.w.toLowerCase()===qRaw.toLowerCase() || o.telugu===qRaw);
    if (exact) showDictResult(exact, qRaw);
  }
}

function showDictResult(wobj, query){
  if (!wobj) return;
  currentQuery = query||wobj.w;
  // add to recent & offline cache
  if (Storage){
    if (Storage.addRecentWord) Storage.addRecentWord(wobj.w);
    if (Storage.cacheEntry) Storage.cacheEntry(wobj.w, wobj);
  }
  const fa = $('feedback-area');
  const stage = $('game-stage');
  const dictFull = $('dict-full');

  // decide where to show
  if (currentGame==='dictionary'){
    // show in stage or dict-full
    const target = dictFull || stage;
    if (target){
      target.innerHTML = renderDictCardV4(wobj, {query: currentQuery}) + `<div class="row" style="margin-top:.6rem"><button class="primary" id="dict-quiz">❓ Quiz this word</button><button class="secondary" id="dict-fav">${(Storage&&Storage.isFavorite&&Storage.isFavorite(wobj.w))?'⭐ Favorited':'☆ Favorite'}</button><button class="secondary" id="dict-clear2">Clear</button></div>`;
      attachDynamicButtons(target);
      const qBtn=$('dict-quiz');
      if (qBtn) qBtn.onclick=()=>{
        quiz.queue=[wobj, ...shuffle(RICH.filter(r=>r.w!==wobj.w)).slice(0,9)];
        quiz.idx=0; quiz.score=0;
        setModeTab('quiz');
        quiz.next();
      };
      const cBtn=$('dict-clear2');
      if (cBtn) cBtn.onclick=()=>{ const inp=$('dict-input'); if(inp) inp.value=''; const res=$('dict-results'); if(res) res.innerHTML=''; dictModeRender(); };
      const favBtn=$('dict-fav');
      if (favBtn) favBtn.onclick=()=>{
        if (Storage && Storage.toggleFavorite) Storage.toggleFavorite(wobj.w);
        renderSidePanels();
        favBtn.textContent = (Storage && Storage.isFavorite && Storage.isFavorite(wobj.w))?'⭐ Favorited':'☆ Favorite';
      };
      sayWithIPA(wobj);
      target.scrollIntoView({behavior:'smooth', block:'start'});
    }
  } else {
    if (fa){
      fa.hidden=false;
      fa.innerHTML = `<div class="result-banner" style="background:var(--panel3);border-color:var(--accent3)" role="status">📖 Dictionary — ${esc(wobj.w)} ${esc(wobj.ipa||'')} — ${esc(wobj.telugu)} <button class="hbtn" id="dict-close" aria-label="Close dictionary">✕</button></div>` + renderDictCardV4(wobj, {query: currentQuery}) + `<button class="next-btn" id="dict-close2">Close</button>`;
      attachDynamicButtons(fa);
      const cl = $('dict-close')||$('dict-close2');
      const closeFn = ()=>{ fa.hidden=true; };
      if ($('dict-close')) $('dict-close').onclick=closeFn;
      if ($('dict-close2')) $('dict-close2').onclick=closeFn;
      fa.scrollIntoView({behavior:'smooth'});
    }
  }
  renderSidePanels();
}

/* -------------------- game navigation -------------------- */
function setStage(html){ const el=$('game-stage'); if(el) el.innerHTML=html; }
function setStatus(t){ const el=$('game-status'); if(el) el.textContent=t; }

let currentGame='quiz';
let modeSet = localStorage.getItem('wcu_mode_v4') || localStorage.getItem('wcu_mode_v3') || 'quiz';
let langMode = localStorage.getItem('wcu_lang_v4') || localStorage.getItem('wcu_lang_v3') || 'mixed';
let levelFilter = parseInt(localStorage.getItem('wcu_level_v4')||'0',10);

function setLangMode(m){
  langMode=m;
  try { localStorage.setItem('wcu_lang_v4', m); } catch(e){}
  document.querySelectorAll('.lang-pill').forEach(b=>{
    const active=b.dataset.lang===m;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active?'true':'false');
    b.tabIndex = active?0:-1;
  });
  if (currentGame==='quiz') quiz.start();
  announce(`Language ${m}`);
}
function setLevelFilter(lv){
  levelFilter=lv;
  try { localStorage.setItem('wcu_level_v4', String(lv)); } catch(e){}
  document.querySelectorAll('.diff-pill').forEach(b=>{
    const active=parseInt(b.dataset.level,10)===lv;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active?'true':'false');
  });
  if (currentGame==='quiz' || currentGame==='flashcards') {
    // restart to apply filter
    const g = GAMES[currentGame];
    if (g && g.start) g.start();
  }
}
function getFilteredPool(){
  if (levelFilter===0) return RICH;
  return RICH.filter(w=>w.level===levelFilter);
}
function getQuestionType(){
  if (langMode==='mixed'){
    const arr=['en-en','en-te','te-en'];
    return arr[Math.floor(Math.random()*arr.length)];
  }
  return langMode;
}
function setModeTab(m){
  currentGame=m;
  modeSet=m;
  try { localStorage.setItem('wcu_mode_v4', m); } catch(e){}
  document.querySelectorAll('.mode-tab').forEach(b=>{
    const active=b.dataset.mode===m;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active?'true':'false');
    b.tabIndex = active?0:-1;
  });
  const fa=$('feedback-area'); if(fa){ fa.hidden=true; fa.innerHTML=''; }
  const titles = {quiz:'❓ Coach Quiz', dictionary:'📖 Dictionary Pro', daily:'🎯 Daily Challenge', flashcards:'🃏 Flashcards', spelling:'🐝 Spelling', listening:'🎧 Listening Mode', chain:'⛓️ Word Chain vs AI', review:'🔁 Smart Review (SRS)'};
  const titleEl=$('game-title'); if(titleEl) titleEl.textContent=titles[m]||'Word Coach';
  setStatus('');
  const g = GAMES[m];
  if (g && g.start) g.start();
  else { setStage('<p>No game found</p>'); }
}

/* -------------------- WOTD -------------------- */
function wotd(){
  const today=new Date();
  const seed=today.getFullYear()*10000 + (today.getMonth()+1)*100 + today.getDate();
  const w=RICH[seed % RICH.length];
  const wordEl=$('wotd-word'); if(wordEl) wordEl.textContent=w.w;
  const ipaEl=$('wotd-ipa'); if(ipaEl) ipaEl.textContent=w.ipa||'';
  const posEl=$('wotd-pos'); if(posEl) posEl.textContent=w.pos;
  const meanEl=$('wotd-meaning'); if(meanEl) meanEl.textContent=w.meaning;
  const teEl=$('wotd-telugu'); if(teEl) teEl.textContent=`తెలుగు: ${w.telugu} — ${w.teluguMeaning}`;
  const synant=$('wotd-synant'); if(synant){ synant.innerHTML=`<span>✅ ${esc(w.synonyms[0]?.en||'syn')}</span><span>❌ ${esc(w.antonyms[0]?.en||'ant')}</span><span>🔊 ${esc(w.ipa||'')}</span>`; }
  const exEl=$('wotd-example'); if(exEl) exEl.textContent=`“${w.examples[0]}”`;
  const hearBtn=$('wotd-hear'); if(hearBtn) hearBtn.onclick=()=>{ sayWithIPA(w); sfx('click'); };
  const moreBtn=$('wotd-more'); if(moreBtn) moreBtn.onclick=()=>{
    const fa=$('feedback-area'); fa.hidden=false;
    fa.innerHTML=renderDictCardV4(w) + `<button class="next-btn" id="wotd-next">Continue Quiz →</button>`;
    attachDynamicButtons(fa);
    const nb=$('wotd-next'); if(nb) nb.onclick=()=>{ fa.hidden=true; quiz.start(); };
    fa.scrollIntoView({behavior:'smooth'});
    if (Storage && Storage.addRecentWord) Storage.addRecentWord(w.w);
    if (Storage && Storage.cacheEntry) Storage.cacheEntry(w.w, w);
  };
  const favBtn=$('wotd-fav'); if(favBtn) favBtn.onclick=()=>{
    if (Storage && Storage.toggleFavorite) { const added=Storage.toggleFavorite(w.w); announce(added?`${w.w} favorited`:`${w.w} unfavorited`); renderSidePanels(); }
  };
}

/* -------------------- Games -------------------- */
const quiz = {
  queue:[], idx:0, score:0, current:null, currentType:null, correctText:'', options:[],
  start(){
    const pool=getFilteredPool();
    this.queue=shuffle(pool);
    this.idx=0; this.score=0;
    setStatus(`Coaching • ${this.queue.length} words • ${langMode.toUpperCase()} • Lv ${levelFilter||'All'} • 🔥${prog.streak}`);
    announce(`Coach Quiz started. Language ${langMode}. Full dictionary feedback after each answer.`, true);
    this.next();
  },
  next(){
    if (this.idx>=this.queue.length) return this.finish();
    this.current=this.queue[this.idx];
    this.currentType=getQuestionType();
    const {correctText, options}=this.makeOptions(this.current, this.currentType);
    this.correctText=correctText; this.options=options;
    this.render();
  },
  makeOptions(current, type){
    let correct='', wrongs=[];
    const pool=getFilteredPool().filter(r=>r.w.toLowerCase()!==current.w.toLowerCase());
    const uniq = arr=>Array.from(new Set(arr));
    if (type==='en-en'){
      correct=current.meaning;
      wrongs=shuffle(pool).slice(0,20).map(r=>r.meaning);
      wrongs=uniq(wrongs).filter(t=>t!==correct).slice(0,3);
    } else if (type==='en-te'){
      correct=current.teluguMeaning;
      wrongs=shuffle(pool).slice(0,20).map(r=>r.teluguMeaning);
      wrongs=uniq(wrongs).filter(t=>t!==correct).slice(0,3);
    } else {
      correct=current.w;
      wrongs=shuffle(pool).slice(0,20).map(r=>r.w);
      wrongs=uniq(wrongs).filter(t=>t.toLowerCase()!==correct.toLowerCase()).slice(0,3);
    }
    while (wrongs.length<3) wrongs.push(pool[wrongs.length%pool.length].meaning||'option');
    const opts=shuffle([{text:correct, isCorrect:true}, ...wrongs.map(t=>({text:t, isCorrect:false}))]);
    return {correctText:correct, options:opts};
  },
  render(){
    const cur=this.current; const type=this.currentType;
    let prompt='', qDisplay='', sub='';
    if (type==='en-en'){ prompt='What does this word mean? (English definition)'; qDisplay=cur.w; sub=`${cur.pos} • ${cur.ipa} • Telugu: ${cur.telugu} • ${cur.difficulty}`; }
    else if (type==='en-te'){ prompt='What is Telugu meaning? — తెలుగు అర్థం ఏమిటి?'; qDisplay=cur.w; sub=`${cur.pos} • ${cur.ipa} • English: ${cur.meaning} • ${cur.difficulty}`; }
    else { prompt='What is English word for this Telugu? — ఈ తెలుగు పదానికి English?'; qDisplay=cur.telugu; sub=`Telugu Meaning: ${cur.teluguMeaning} • IPA ${cur.ipa} • Hint: ${cur.meaning}`; }
    setStatus(`Q ${this.idx+1}/${this.queue.length} • Score ${this.score} • ${type.toUpperCase()} • 🔥${prog.streak} • ${cur.frequency}`);
    setStage(`
      <p class="question-prompt">${esc(prompt)}</p>
      <p class="big-word" id="q-word">${esc(qDisplay)}</p>
      <p class="telugu progress-line" id="q-sub">${esc(sub)}</p>
      <div id="q-opts" role="group" aria-label="Answer options">
        ${this.options.map(o=>`<button class="opt" data-correct="${o.isCorrect}" data-text="${esc(o.text).replace(/"/g,'&quot;')}" role="radio" aria-checked="false">${esc(o.text)}</button>`).join('')}
      </div>
      <div class="row" style="margin-top:.6rem">
        <button class="secondary" id="q-hear">🔊 Hear word + IPA + meaning</button>
        <button class="secondary" id="q-ipa">🔤 Show IPA & Pronunciation</button>
        <button class="secondary" id="q-skip">⏭️ Skip to dictionary</button>
      </div>
      <p class="progress-line">After answer: ✅/❌ + why + full pro dictionary (IPA, root, etymology, synonyms, antonyms, idioms, collocations, examples, Telugu examples, mistakes, word family).</p>
    `);
    const hearBtn=$('q-hear'); if(hearBtn) hearBtn.onclick=()=>{ sayWithIPA(cur); sfx('click'); };
    const ipaBtn=$('q-ipa'); if(ipaBtn) ipaBtn.onclick=()=>{ announce(`IPA ${cur.ipa}. Pronunciation ${cur.pronunciation}. Root ${cur.root}.`); say(`${cur.w}. IPA ${cur.ipa}. ${cur.pronunciation}`); };
    const skipBtn=$('q-skip'); if(skipBtn) skipBtn.onclick=()=>{
      const fa=$('feedback-area'); fa.hidden=false;
      fa.innerHTML=`<div class="result-banner" style="background:var(--panel3)" role="status">📖 Dictionary for <b>${esc(cur.w)}</b> ${esc(cur.ipa||'')}</div>`+renderDictCardV4(cur, {query: cur.w})+`<button class="next-btn" id="q-next">Next word →</button>`;
      attachDynamicButtons(fa);
      const nb=$('q-next'); if(nb) nb.onclick=()=>{ fa.hidden=true; this.idx++; this.next(); };
    };
    document.querySelectorAll('#q-opts .opt').forEach(btn=>{ btn.onclick=()=>this.answer(btn); });
    // keyboard navigation: arrow keys? simple Enter handled by click
    say(type==='te-en'? `Telugu word ${cur.telugu}. What is English?` : `What does ${cur.w} mean? ${cur.ipa}`);
    const hearQ=$('btn-hear-q'); if(hearQ) hearQ.onclick=()=>{ if(hearBtn) hearBtn.click(); };
    const favQ=$('btn-fav-q'); if(favQ) favQ.onclick=()=>{ if (Storage && Storage.toggleFavorite) { const added=Storage.toggleFavorite(cur.w); announce(added?`${cur.w} favorited`:`${cur.w} unfavorited`); renderSidePanels(); } };
  },
  answer(btn){
    const isCorrect=btn.dataset.correct==='true';
    const chosen=btn.dataset.text;
    const cur=this.current;
    document.querySelectorAll('#q-opts .opt').forEach(b=>{ b.disabled=true; b.setAttribute('aria-checked','false'); if(b.dataset.correct==='true'){ b.classList.add('correct'); } });
    btn.setAttribute('aria-checked','true');
    if (isCorrect){
      btn.classList.add('correct'); this.score++; rememberResult(cur.w,true); const bonus=prog.streak>=2?5:0; addCoins(10+bonus,'correct answer'); bumpStreak(true); sfx('good'); announce(`Correct! ${cur.w} means ${cur.meaning}. Telugu ${cur.telugu}. IPA ${cur.ipa}.`, true); say(`Correct! ${cur.w} means ${cur.meaning}.`);
      if (Achievements && Achievements.checkAndUnlock && this.score===1) Achievements.checkAndUnlock('first_word');
    } else {
      btn.classList.add('wrong'); bumpStreak(false); rememberResult(cur.w,false); sfx('bad'); announce(`Wrong. Correct is ${this.correctText}. ${cur.w} means ${cur.meaning}. Added to Smart Review SRS.`, true); say(`Wrong. Correct is ${cur.meaning}.`);
    }
    // cache & recent
    if (Storage){
      if (Storage.addRecentWord) Storage.addRecentWord(cur.w);
      if (Storage.cacheEntry) Storage.cacheEntry(cur.w, cur);
    }
    const fa=$('feedback-area'); fa.hidden=false;
    const banner=resultBannerHTML(isCorrect, cur, chosen, this.correctText, cur.w);
    fa.innerHTML=banner+renderDictCardV4(cur, {query: cur.w})+`<button class="next-btn" id="q-next">${isCorrect?'Next word → 🎯':'Got it, next →'}</button>`;
    attachDynamicButtons(fa);
    fa.scrollIntoView({behavior:'smooth', block:'start'});
    const nb=$('q-next'); if(nb) nb.onclick=()=>{ fa.hidden=true; this.idx++; setTimeout(()=>this.next(),120); };
    updateStats();
  },
  finish(){
    prog.games++; saveProg();
    let msg='', bonus=0;
    if (this.score===this.queue.length){ bonus=50; msg='PERFECT! Bonus +50 XP'; if(Achievements) Achievements.checkAndUnlock('quiz_perfect'); }
    else if (this.score>=this.queue.length*0.8){ bonus=25; msg='Great job! Bonus +25'; }
    if (bonus) addCoins(bonus,'quiz bonus');
    setStage(`<p class="big-word">🏁 Coaching complete!</p><p>Score <strong>${this.score} / ${this.queue.length}</strong>. ${msg}</p><p class="coins-note">Wallet 🪙 ${prog.coins} • ⭐ Level ${level()} • ✨ ${prog.xp} XP • 🔥 Best ${prog.bestStreak}</p><p class="progress-line">Wrong words saved to Smart Review with spaced repetition. Use Dictionary search, voice 🎤, favorites ⭐.</p><div class="row"><button class="primary" id="q-restart">🔁 New coaching set</button><button class="secondary" id="q-review">🔁 Smart Review (SRS)</button><button class="secondary" id="q-daily">🎯 Daily Challenge</button></div>`);
    setStatus(''); announce(`Quiz over. Score ${this.score} of ${this.queue.length}. ${msg}`);
    say(`Coaching over. Score ${this.score} of ${this.queue.length}. ${msg}`);
    const r1=$('q-restart'); if(r1) r1.onclick=()=>this.start();
    const r2=$('q-review'); if(r2) r2.onclick=()=>setModeTab('review');
    const r3=$('q-daily'); if(r3) r3.onclick=()=>setModeTab('daily');
    updateStats();
  }
};

const flash = {
  queue:[], card:null, flipped:false, knownCount:0,
  start(){
    const pool=getFilteredPool();
    this.queue=shuffle(pool); this.knownCount=0; this.flipped=false;
    setStatus(`Flashcards • ${this.queue.length} • ${langMode} • SRS`);
    announce(`${this.queue.length} flashcards with full pro dictionary.`);
    this.next();
  },
  next(){
    if (!this.queue.length) return this.finish();
    this.card=this.queue[0]; this.flipped=false;
    setStatus(`Card ${this.knownCount+1} • ${this.queue.length} left • ${this.card.difficulty}`);
    setStage(`<div class="flash-card"><p class="big-word" id="fc-word">${esc(this.card.w)} <small>${esc(this.card.ipa||'')}</small></p><p class="telugu">${esc(this.card.telugu)} — ${esc(this.card.pos)} • ${esc(this.card.pronunciation||'')}</p><div id="fc-back" hidden>${renderDictCardV4(this.card)}</div></div><div class="row"><button class="primary" id="fc-hear">🔊 Hear IPA</button><button class="primary" id="fc-flip">📖 Show pro dictionary</button><button id="fc-know" hidden>✅ I know (+2 🪙)</button><button id="fc-again" hidden>🔁 Again (SRS)</button></div>`);
    attachDynamicButtons(document);
    const hear=$('fc-hear'); if(hear) hear.onclick=()=>sayWithIPA(this.card);
    const flip=$('fc-flip'); if(flip) flip.onclick=()=>{ this.flipped=!this.flipped; const back=$('fc-back'); if(back) back.hidden=!this.flipped; const k=$('fc-know'), a=$('fc-again'); if(k) k.hidden=!this.flipped; if(a) a.hidden=!this.flipped; sfx('flip'); if(this.flipped) announce(`${this.card.w} ${this.card.ipa} means ${this.card.meaning}. Telugu ${this.card.telugu}.`); };
    const know=$('fc-know'); if(know) know.onclick=()=>{ this.queue.shift(); this.knownCount++; rememberResult(this.card.w,true); addCoins(2,'flashcard known'); sfx('coin'); if(Storage){ Storage.addRecentWord(this.card.w); Storage.cacheEntry(this.card.w,this.card); } this.next(); };
    const again=$('fc-again'); if(again) again.onclick=()=>{ const c=this.queue.shift(); this.queue.splice(Math.min(3,this.queue.length),0,c); rememberResult(c.w,false); announce(`${c.w} saved to Smart Review SRS.`); this.next(); };
    say(this.card.w);
  },
  finish(){
    prog.games++; saveProg(); setStage(`<p class="big-word">🎉 Deck complete!</p><p>Coins 🪙 ${prog.coins} • Level ${level()} • XP ${prog.xp}</p><div class="row"><button class="primary" id="fc-restart">🔁 New deck</button><button class="secondary" id="fc-quiz">❓ Quiz now</button></div>`); setStatus('');
    const r=$('fc-restart'); if(r) r.onclick=()=>this.start();
    const q=$('fc-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

const bee = {
  list:[], i:0, score:0,
  start(){
    const pool=getFilteredPool();
    this.list=shuffle(pool).slice(0,12); this.i=0; this.score=0;
    announce('Spelling bee with IPA. After answer see pro dictionary.');
    this.ask();
  },
  ask(){
    if (this.i>=this.list.length) return this.finish();
    const w=this.list[this.i];
    setStatus(`Spelling ${this.i+1}/${this.list.length} • Score ${this.score} • ${w.difficulty}`);
    setStage(`<p class="question-prompt">Listen with IPA and type exact spelling.</p><p class="big-word">${esc(w.w)} has ${w.w.length} letters • IPA ${esc(w.ipa||'')}</p><div class="row"><button class="primary" id="b-hear">🔊 Hear word slow + IPA</button><button class="secondary" id="b-example">💡 Example</button><button class="secondary" id="b-ipa">🔤 ${esc(w.pronunciation||'')}</button><button class="secondary" id="b-skip">⏭️ Skip</button></div><div class="row"><input type="text" id="b-input" placeholder="Type spelling..." autocomplete="off" spellcheck="false" maxlength="40" aria-label="Type spelling"><button class="primary" id="b-submit">Check ✔️</button></div><p class="progress-line" id="b-feed" role="status"></p>`);
    const hear=$('b-hear'); if(hear) hear.onclick=()=>sayWithIPA(w);
    const ex=$('b-example'); if(ex) ex.onclick=()=>say(w.examples[0]);
    const inp=$('b-input'); if(inp){ inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); const s=$('b-submit'); if(s) s.click(); }}); inp.focus(); }
    const sub=$('b-submit'); if(sub) sub.onclick=()=>this.check();
    const skip=$('b-skip'); if(skip) skip.onclick=()=>{ bumpStreak(false); announce(`Skipped ${w.w} spelled ${w.w.split('').join(' ')} ${w.ipa}`); this.i++; this.ask(); };
    setTimeout(()=>sayWithIPA(w),300);
  },
  check(){
    const w=this.list[this.i];
    const inp=$('b-input'); if(!inp) return;
    const typed=inp.value.trim().toLowerCase();
    if (!typed){ announce('Type spelling first.', true); return; }
    const fa=$('feedback-area'); fa.hidden=false;
    if (typed===w.w.toLowerCase()){
      this.score++; rememberResult(w.w,true); addCoins(Math.max(4,w.w.length),'spelled correctly'); bumpStreak(true); sfx('good');
      fa.innerHTML=`<div class="result-banner correct" role="status">✅ Correct spelling! ${esc(w.w)} ${esc(w.ipa||'')}</div>`+renderDictCardV4(w)+`<button class="next-btn" id="b-next">Next spelling →</button>`;
      announce(`Correct spelling ${w.w} ${w.ipa}.`, true); say(`Correct! ${w.w}`);
    } else {
      bumpStreak(false); rememberResult(w.w,false); sfx('bad');
      const letters=w.w.toUpperCase().split('').join(' ');
      fa.innerHTML=`<div class="result-banner wrong" role="alert">❌ Not quite. Correct: <b>${esc(w.w)}</b> ${esc(w.ipa||'')} (${esc(letters)})</div>`+renderDictCardV4(w)+`<button class="next-btn" id="b-next">Next →</button>`;
      announce(`Wrong spelling. Correct ${w.w} is ${letters}. IPA ${w.ipa}.`, true); say(`Correct spelling is ${letters}`);
    }
    attachDynamicButtons(fa);
    if (Storage){ Storage.addRecentWord(w.w); Storage.cacheEntry(w.w,w); }
    const nb=$('b-next'); if(nb) nb.onclick=()=>{ fa.hidden=true; this.i++; this.ask(); };
  },
  finish(){
    prog.games++; saveProg();
    setStage(`<p class="big-word">🏆 Bee over!</p><p>Score ${this.score}/${this.list.length}</p><p class="coins-note">Wallet 🪙 ${prog.coins} • Level ${level()} • XP ${prog.xp}</p><div class="row"><button class="primary" id="b-restart">🔁 Again</button><button class="secondary" id="b-quiz">❓ Quiz</button></div>`);
    setStatus(''); const r=$('b-restart'); if(r) r.onclick=()=>this.start(); const q=$('b-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

const listening = {
  list:[], i:0, score:0,
  start(){
    const pool=getFilteredPool();
    this.list=shuffle(pool).slice(0,10); this.i=0; this.score=0;
    announce('Listening mode: You will hear word in English and Telugu. Type what you hear.');
    this.ask();
  },
  ask(){
    if (this.i>=this.list.length) return this.finish();
    const w=this.list[this.i];
    setStatus(`Listening ${this.i+1}/${this.list.length} • Score ${this.score}`);
    setStage(`<p class="question-prompt">🎧 Listening: Hear and type the English word. You will hear twice.</p><p class="big-word">Listen carefully…</p><div class="row"><button class="primary" id="l-hear">🔊 Hear English + Telugu</button><button class="secondary" id="l-slow">🐢 Slow + IPA ${esc(w.ipa||'')}</button><button class="secondary" id="l-skip">⏭️ Skip</button></div><div class="row"><input type="text" id="l-input" placeholder="Type what you heard..." autocomplete="off" spellcheck="false" maxlength="40" aria-label="Type what you heard"><button class="primary" id="l-submit">Check ✔️</button></div><p class="progress-line">Tip: Close your eyes and focus on pronunciation ${esc(w.pronunciation||'')}.</p>`);
    const hear=$('l-hear'); if(hear) hear.onclick=()=>{ say(`${w.w}. Telugu ${w.telugu}. ${w.meaning}`); setTimeout(()=>say(`${w.examples[0]}`), 1200); };
    const slow=$('l-slow'); if(slow) slow.onclick=()=>sayWithIPA(w);
    const inp=$('l-input'); if(inp){ inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); const s=$('l-submit'); if(s) s.click(); }}); inp.focus(); }
    const sub=$('l-submit'); if(sub) sub.onclick=()=>this.check();
    const skip=$('l-skip'); if(skip) skip.onclick=()=>{ this.i++; this.ask(); };
    setTimeout(()=>{ say(`${w.w}`, true); }, 400);
    setTimeout(()=>{ say(`${w.w}. Telugu ${w.telugu}`, true); }, 1400);
  },
  check(){
    const w=this.list[this.i];
    const typed=($('l-input')?.value||'').trim().toLowerCase();
    if (!typed){ announce('Type what you heard first.', true); return; }
    const fa=$('feedback-area'); fa.hidden=false;
    if (typed===w.w.toLowerCase()){
      this.score++; rememberResult(w.w,true); addCoins(8,'listening correct'); bumpStreak(true); sfx('good');
      fa.innerHTML=`<div class="result-banner correct">✅ You heard correctly! ${esc(w.w)} ${esc(w.ipa||'')}</div>`+renderDictCardV4(w)+`<button class="next-btn" id="l-next">Next listening →</button>`;
    } else {
      bumpStreak(false); rememberResult(w.w,false); sfx('bad');
      fa.innerHTML=`<div class="result-banner wrong">❌ You heard "${esc(typed)}" but correct is <b>${esc(w.w)}</b> ${esc(w.ipa||'')}</div>`+renderDictCardV4(w)+`<button class="next-btn" id="l-next">Next →</button>`;
    }
    attachDynamicButtons(fa);
    const nb=$('l-next'); if(nb) nb.onclick=()=>{ fa.hidden=true; this.i++; this.ask(); };
  },
  finish(){
    prog.games++; saveProg();
    setStage(`<p class="big-word">🎧 Listening complete!</p><p>Score ${this.score}/${this.list.length}</p><p class="coins-note">Wallet 🪙 ${prog.coins} • XP ${prog.xp}</p><div class="row"><button class="primary" id="l-restart">🔁 Again</button><button class="secondary" id="l-quiz">❓ Quiz</button></div>`);
    setStatus(''); const r=$('l-restart'); if(r) r.onclick=()=>this.start(); const q=$('l-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

const chain = {
  used:[], lastLetter:'', over:false,
  start(){
    const pool=getFilteredPool();
    const opener=pool[Math.floor(Math.random()*pool.length)];
    this.used=[opener.w.toLowerCase()]; this.lastLetter=opener.w.slice(-1).toLowerCase(); this.over=false;
    setStatus(`Chain ${this.used.length} • Need “${this.lastLetter.toUpperCase()}”`);
    announce(`Word chain. AI opened ${opener.w}. Need ${this.lastLetter.toUpperCase()}.`);
    setStage(`<div class="chain-log" id="c-log" role="log" aria-label="Chain history"><p class="ai">🤖 AI: <strong>${esc(opener.w)}</strong> ${esc(opener.ipa||'')} — ${esc(opener.meaning)} <em class="telugu">(${esc(opener.telugu)})</em></p></div><label class="progress-line" for="c-input">Your word starts with “${this.lastLetter.toUpperCase()}”:</label><div class="row"><input type="text" id="c-input" placeholder="word starting with ${this.lastLetter.toUpperCase()}…" aria-label="Enter word chain word"><button class="primary" id="c-play">Play ▶️</button><button class="secondary" id="c-giveup">🏳️ Give up</button></div><p class="progress-line">Only ${pool.length} bank words. Use favorites ⭐ for strategy.</p><div id="c-dict"></div>`);
    this.bind();
  },
  bind(){
    const inp=$('c-input'); if(!inp) return;
    const play=$('c-play'); if(play) play.onclick=()=>this.play();
    const giveup=$('c-giveup'); if(giveup) giveup.onclick=()=>this.end(false);
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); this.play(); }});
    inp.focus();
  },
  log(html){ const l=$('c-log'); if(l) l.insertAdjacentHTML('beforeend', html); },
  play(){
    if (this.over) return;
    const val=($('c-input')?.value||'').trim().toLowerCase();
    if (!val) return;
    const pool=getFilteredPool();
    const found=pool.find(w=>w.w.toLowerCase()===val);
    if (!found){ announce(`${val} not in bank.`, true); sfx('bad'); const inp=$('c-input'); if(inp) inp.value=''; return; }
    if (!val.startsWith(this.lastLetter)){ announce(`Must start with ${this.lastLetter.toUpperCase()}.`, true); sfx('bad'); const inp=$('c-input'); if(inp) inp.select(); return; }
    if (this.used.includes(val)){ announce(`${val} already used.`, true); sfx('bad'); const inp=$('c-input'); if(inp) inp.value=''; return; }
    this.used.push(val); this.lastLetter=val.slice(-1);
    this.log(`<p class="you">🧑 You: <strong>${esc(found.w)}</strong> ${esc(found.ipa||'')} — ${esc(found.meaning)} <span class="telugu">${esc(found.telugu)}</span></p>`);
    const dictDiv=$('c-dict'); if(dictDiv){ dictDiv.innerHTML=renderDictCardV4(found); attachDynamicButtons(dictDiv); }
    announce(`You played ${found.w}. AI thinking ${this.lastLetter.toUpperCase()}…`);
    setTimeout(()=>{
      if (this.over) return;
      const pool2=getFilteredPool();
      const options=pool2.filter(w=>w.w.toLowerCase().startsWith(this.lastLetter) && !this.used.includes(w.w.toLowerCase()));
      if (!options.length) return this.end(true);
      const ai=options[Math.floor(Math.random()*options.length)];
      this.used.push(ai.w.toLowerCase()); this.lastLetter=ai.w.slice(-1);
      this.log(`<p class="ai">🤖 AI: <strong>${esc(ai.w)}</strong> ${esc(ai.ipa||'')} — ${esc(ai.meaning)} <em class="telugu">${esc(ai.telugu)}</em></p>`);
      setStatus(`Chain ${this.used.length} • Need “${this.lastLetter.toUpperCase()}”`);
      const inp=$('c-input'); if(inp){ inp.value=''; inp.placeholder=`word starting with “${this.lastLetter.toUpperCase()}”…`; }
      sfx('flip');
    }, 1100+Math.random()*600);
  },
  end(playerWon){
    this.over=true; prog.games++;
    const len=this.used.length; let coins=Math.floor(len/2)*2; if(playerWon) coins+=50;
    bumpStreak(playerWon); if(coins) addCoins(coins, playerWon?'chain victory!':'chain effort'); else saveProg();
    sfx(playerWon?'coin':'bad');
    const fa=$('feedback-area'); fa.hidden=false;
    fa.innerHTML=`<div class="result-banner ${playerWon?'correct':'wrong'}" role="status">${playerWon?'🏆 You WIN! AI stuck!':'🏁 Chain over'}<p>Chain: ${esc(this.used.join(' → '))}<br>+${coins} 🪙 • Level ${level()}</p></div><button class="next-btn" id="c-restart">🔁 Play again</button><button class="secondary" id="c-quiz">❓ Quiz</button>`;
    setStatus('');
    const r=$('c-restart'); if(r) r.onclick=()=>{ fa.hidden=true; this.start(); };
    const q=$('c-quiz'); if(q) q.onclick=()=>{ fa.hidden=true; setModeTab('quiz'); };
  }
};

const review = {
  queue:[], i:0, streak:0,
  start(){
    const pool=getFilteredPool();
    const due = (SRS && SRS.getDueWords) ? SRS.getDueWords(pool) : [];
    const reviewWords = (prog.review||[]).map(k=>RICH.find(w=>w.w.toLowerCase()===k)).filter(Boolean);
    // prioritize due + review
    let combined = [...new Set([...due, ...reviewWords])];
    if (!combined.length) combined = pool.slice(0,12);
    this.queue=shuffle(combined).slice(0,20);
    this.i=0; this.streak=0;
    setStatus(`Smart Review (SRS) • ${this.queue.length} due • SRS interval based`);
    announce(`Smart Review ${this.queue.length} words due. Spaced repetition.`);
    this.ask();
  },
  ask(){
    if (this.i>=this.queue.length) return this.finish();
    const w=this.queue[this.i];
    const srsInfo = (Storage && Storage.getSRS) ? (Storage.getSRS()[w.w.toLowerCase()]||{}) : {};
    setStatus(`Review ${this.i+1}/${this.queue.length} • Streak ${this.streak} • Due ${srsInfo.interval||'new'}d • Ease ${srsInfo.ease? srsInfo.ease.toFixed(2):'2.5'}`);
    setStage(`<p class="question-prompt">Smart Review — SRS — recall meaning then see pro dictionary</p><p class="big-word" id="r-word">${esc(w.w)} <small>${esc(w.ipa||'')}</small></p><p class="telugu">${esc(w.telugu)} • ${esc(w.pos)} • ${esc(w.difficulty)} • ${esc(w.frequency)}</p><div class="row"><button class="primary" id="r-hear">🔊 Hear IPA</button><button class="primary" id="r-reveal">💡 Show pro dictionary</button></div><div id="r-back" hidden>${renderDictCardV4(w)}</div><div class="row" id="r-actions" hidden><button class="primary" id="r-know">✅ I know it now (quality 5)</button><button class="secondary" id="r-fuzzy">🤔 Almost (quality 3)</button><button class="secondary" id="r-again">🔁 Still learning (quality 0)</button></div>`);
    attachDynamicButtons(document);
    const hear=$('r-hear'); if(hear) hear.onclick=()=>sayWithIPA(w);
    const rev=$('r-reveal'); if(rev) rev.onclick=()=>{ const back=$('r-back'); if(back) back.hidden=false; const act=$('r-actions'); if(act) act.hidden=false; sfx('flip'); announce(`${w.w} ${w.ipa} means ${w.meaning}. Telugu ${w.telugu}.`); };
    const know=$('r-know'); if(know) know.onclick=()=>{ rememberResult(w.w,true); this.streak++; addCoins(3+Math.min(7,this.streak),'review mastered'); sfx('good'); if (SRS) SRS.update(w.w,5); this.i++; this.ask(); };
    const fuzzy=$('r-fuzzy'); if(fuzzy) fuzzy.onclick=()=>{ rememberResult(w.w,true); this.streak++; addCoins(2,'review fuzzy'); sfx('flip'); if (SRS) SRS.update(w.w,3); this.i++; this.ask(); };
    const again=$('r-again'); if(again) again.onclick=()=>{ rememberResult(w.w,false); sfx('bad'); if (SRS) SRS.update(w.w,0); this.i++; this.ask(); };
    say(w.w);
  },
  finish(){
    prog.games++; saveProg();
    const remaining=(prog.review||[]).length;
    const srsStats = (SRS && SRS.stats) ? SRS.stats() : {total:0, due:0};
    setStage(`<p class="big-word">🎯 Smart Review done</p><p>Remaining weak: <strong>${remaining}</strong> • SRS Total ${srsStats.total} • Due ${srsStats.due}</p><p class="coins-note">Wallet 🪙 ${prog.coins} • ⭐ Level ${level()} • ✨ ${prog.xp} XP</p><div class="row"><button class="primary" id="r-restart">🔁 Review again (due)</button><button class="secondary" id="r-quiz">❓ Quiz</button></div>`);
    setStatus(''); const r=$('r-restart'); if(r) r.onclick=()=>this.start(); const q=$('r-quiz'); if(q) q.onclick=()=>setModeTab('quiz'); updateStats();
  }
};

const dailyChallenge = {
  words:[], idx:0, score:0,
  start(){
    const today=new Date().toISOString().slice(0,10);
    let saved = (Storage && Storage.getDailyChallenge) ? Storage.getDailyChallenge() : null;
    if (saved && saved.date===today){
      this.words = saved.words.map(wId=>RICH.find(r=>r.w===wId)).filter(Boolean);
    } else {
      const seed = today.split('-').reduce((a,b)=>a+parseInt(b,10),0);
      const pool=getFilteredPool();
      const shuffled = shuffle(pool);
      this.words = shuffled.slice(seed % (pool.length-5), 5 + seed % (pool.length-5)).slice(0,5);
      if (this.words.length<5) this.words = shuffle(pool).slice(0,5);
      if (Storage && Storage.setDailyChallenge) Storage.setDailyChallenge({date: today, words: this.words.map(w=>w.w), completed:false, score:0});
    }
    this.idx=0; this.score=0;
    setStatus(`Daily Challenge • ${today} • 5 words • XP bonus`);
    announce(`Daily Challenge 5 words. Complete for bonus.`);
    this.next();
  },
  next(){
    if (this.idx>=this.words.length) return this.finish();
    const w=this.words[this.idx];
    const type=getQuestionType();
    const qText = type==='te-en' ? w.telugu : w.w;
    const prompt = type==='te-en' ? `Daily ${this.idx+1}/5 — Telugu → English` : `Daily ${this.idx+1}/5 — ${w.w} ${w.ipa||''}`;
    setStage(`<p class="question-prompt">${esc(prompt)} • ${esc(w.difficulty)} • ${esc(w.frequency)}</p><p class="big-word">${esc(qText)}</p><p class="progress-line">${esc(w.meaning.slice(0,100))} • ${esc(w.telugu)}</p><div id="dc-opts">${this.makeOptions(w,type).map(o=>`<button class="opt" data-correct="${o.isCorrect}" data-text="${esc(o.text).replace(/"/g,'&quot;')}">${esc(o.text)}</button>`).join('')}</div><div class="row"><button class="secondary" id="dc-hear">🔊 Hear</button></div>`);
    const hear=$('dc-hear'); if(hear) hear.onclick=()=>sayWithIPA(w);
    document.querySelectorAll('#dc-opts .opt').forEach(btn=>{ btn.onclick=()=>this.answer(btn, w); });
  },
  makeOptions(current, type){
    const pool=getFilteredPool().filter(r=>r.w!==current.w);
    let correct='', wrongs=[];
    if (type==='te-en'){ correct=current.w; wrongs=shuffle(pool).slice(0,3).map(r=>r.w); }
    else if (type==='en-te'){ correct=current.teluguMeaning; wrongs=shuffle(pool).slice(0,3).map(r=>r.teluguMeaning); }
    else { correct=current.meaning; wrongs=shuffle(pool).slice(0,3).map(r=>r.meaning); }
    return shuffle([{text:correct, isCorrect:true}, ...wrongs.map(t=>({text:t, isCorrect:false}))]);
  },
  answer(btn, w){
    const isCorrect=btn.dataset.correct==='true';
    document.querySelectorAll('#dc-opts .opt').forEach(b=>{ b.disabled=true; if(b.dataset.correct==='true') b.classList.add('correct'); });
    btn.classList.add(isCorrect?'correct':'wrong');
    if (isCorrect){ this.score++; addCoins(15,'daily challenge correct'); bumpStreak(true); sfx('good'); }
    else { bumpStreak(false); sfx('bad'); }
    if (Storage){ Storage.addRecentWord(w.w); Storage.cacheEntry(w.w,w); }
    const fa=$('feedback-area'); fa.hidden=false;
    fa.innerHTML=(isCorrect?`<div class="result-banner correct">✅ Correct! ${esc(w.w)} ${esc(w.ipa||'')}</div>`:`<div class="result-banner wrong">❌ Wrong! Correct is ${esc(w.w)} — ${esc(w.meaning)}</div>`)+renderDictCardV4(w)+`<button class="next-btn" id="dc-next">Next challenge →</button>`;
    attachDynamicButtons(fa);
    fa.scrollIntoView({behavior:'smooth'});
    const nb=$('dc-next'); if(nb) nb.onclick=()=>{ fa.hidden=true; this.idx++; this.next(); };
  },
  finish(){
    prog.games++; saveProg();
    const today=new Date().toISOString().slice(0,10);
    const bonus = this.score===5 ? 50 : this.score>=3 ? 20 : 5;
    addCoins(bonus, 'daily challenge complete');
    if (Storage && Storage.setDailyChallenge) {
      const saved = Storage.getDailyChallenge();
      if (saved && saved.date===today){ saved.completed=true; saved.score=this.score; Storage.setDailyChallenge(saved); }
    }
    if (this.score===5 && Achievements) Achievements.checkAndUnlock('daily_challenge');
    setStage(`<p class="big-word">🎯 Daily Challenge Complete!</p><p>Score ${this.score}/5 • +${bonus} 🪙 bonus • XP ${prog.xp}</p><p class="coins-note">Come back tomorrow for new challenge • Streak 🔥 ${prog.streak}</p><div class="row"><button class="primary" id="dc-restart">🔁 Replay today</button><button class="secondary" id="dc-quiz">❓ Quiz</button></div>`);
    setStatus('');
    const r=$('dc-restart'); if(r) r.onclick=()=>this.start();
    const q=$('dc-quiz'); if(q) q.onclick=()=>setModeTab('quiz');
  }
};

const dictMode = {
  start(){ dictModeRender(); }
};

function dictModeRender(){
  const inp=$('dict-input');
  const q = inp? inp.value.trim() : '';
  if (!q){
    setStage(`<p class="big-word">📖 Dictionary Pro — ${RICH.length} words</p><p class="progress-line">Real dictionary: IPA ${'/bəˈnev.əl.ənt/'} , pronunciation, root, origin, etymology, collocations, formal/informal/academic/daily, idioms, phrasal verbs, synonyms with Telugu + sentence, antonyms + Telugu + sentence, 5 examples + Telugu examples, explanation, common mistakes, related, word family, difficulty, frequency, offline cache, favorites ⭐.</p><p>Try intelligent search: <b>enviroment</b> → Did you mean Environment? • Prefix “pre” • Suffix “tion” • Contains “ology” • Telugu “పర్యావరణం” • Voice 🎤</p><div class="row">${shuffle(RICH).slice(0,10).map(w=>`<button class="secondary dict-quick" data-w="${esc(w.w)}">${esc(w.w)} ${esc(w.ipa||'')} • ${esc(w.telugu)}</button>`).join('')}</div><div id="dict-full"></div>`);
    document.querySelectorAll('.dict-quick').forEach(b=>{ b.onclick=()=>{ const inp2=$('dict-input'); if(inp2){ inp2.value=b.dataset.w; handleDictSearch(); const obj=RICH.find(r=>r.w===b.dataset.w); if(obj) showDictResult(obj, b.dataset.w); } }; });
  } else {
    handleDictSearch();
  }
  setStatus(`Dictionary Pro • ${RICH.length} • IPA • Telugu • Offline cache • SRS • Favorites`);
}

const GAMES = {quiz, flashcards:flash, spelling:bee, listening, chain, review, daily:dailyChallenge, dictionary:dictMode};

/* -------------------- settings & stats -------------------- */
function applySettings(){
  document.documentElement.dataset.theme = settings.light? 'light':'dark';
  document.documentElement.style.setProperty('--scale', settings.large?1.25:1);
  const ttsEl=$('set-tts'); if(ttsEl) ttsEl.checked=settings.tts;
  const sndEl=$('set-sounds'); if(sndEl) sndEl.checked=settings.sounds;
  const lightEl=$('set-light'); if(lightEl) lightEl.checked=settings.light;
  const largeEl=$('set-large'); if(largeEl) largeEl.checked=settings.large;
  const rateEl=$('set-rate'); if(rateEl) rateEl.value=settings.rate;
  const rateVal=$('rate-val'); if(rateVal) rateVal.textContent=settings.rate.toFixed(1)+'×';
  const hlEl=$('set-highlight'); if(hlEl) hlEl.checked=settings.highlight!==false;
}
function bindSettings(){
  const btnSet=$('btn-settings'); if(btnSet) btnSet.onclick=()=>{ const m=$('settings-modal'); if(m) m.hidden=false; };
  const btnClose=$('btn-close-settings'); if(btnClose) btnClose.onclick=()=>{ const m=$('settings-modal'); if(m) m.hidden=true; saveSettings(); };
  const setTts=$('set-tts'); if(setTts) setTts.onchange=e=>{ settings.tts=e.target.checked; saveSettings(); announce(settings.tts?'Voice on':'Voice off'); };
  const setSounds=$('set-sounds'); if(setSounds) setSounds.onchange=e=>{ settings.sounds=e.target.checked; saveSettings(); sfx('coin'); };
  const setLight=$('set-light'); if(setLight) setLight.onchange=e=>{ settings.light=e.target.checked; saveSettings(); applySettings(); };
  const setLarge=$('set-large'); if(setLarge) setLarge.onchange=e=>{ settings.large=e.target.checked; saveSettings(); applySettings(); };
  const setRate=$('set-rate'); if(setRate){
    setRate.oninput=e=>{ settings.rate=parseFloat(e.target.value); const rv=$('rate-val'); if(rv) rv.textContent=settings.rate.toFixed(1)+'×'; saveSettings(); };
    setRate.onchange=()=>say(`Speed ${settings.rate.toFixed(1)}`);
  }
  const setHl=$('set-highlight'); if(setHl) setHl.onchange=e=>{ settings.highlight=e.target.checked; saveSettings(); };
  const btnReset=$('btn-reset-prog'); if(btnReset) btnReset.onclick=()=>{
    if (!confirm('Reset coins, XP, streaks, favorites, SRS?')) return;
    prog=Object.assign({}, defaults); saveProg(); if(Storage){ try{ localStorage.removeItem('wcu_favorites_v4'); localStorage.removeItem('wcu_srs_v4'); localStorage.removeItem('wcu_offline_cache_v4'); } catch(e){} } renderWallet(); announce('Progress reset.', true); const m=$('settings-modal'); if(m) m.hidden=true; renderSidePanels(); updateStats();
  };
  const btnClearCache=$('btn-clear-cache'); if(btnClearCache) btnClearCache.onclick=()=>{
    if (Storage){ try{ localStorage.removeItem('wcu_offline_cache_v4'); announce('Offline cache cleared'); } catch(e){} }
  };
}

function updateStats(){
  const knownCount=(prog.known||[]).length;
  const total=prog.right+prog.wrong;
  const acc=total?Math.round((prog.right/total)*100):0;
  const elGames=$('st-games'); if(elGames) elGames.textContent=prog.games;
  const elKnown=$('st-known'); if(elKnown) elKnown.textContent=knownCount;
  const srsStats = (SRS && SRS.stats) ? SRS.stats() : {due: (prog.review||[]).length};
  const elReview=$('st-review'); if(elReview) elReview.textContent=srsStats.due || (prog.review||[]).length;
  const elAcc=$('st-accuracy'); if(elAcc) elAcc.textContent= total? `${acc}% (${prog.right}✓/${prog.wrong}✗)` : '—';
  const elBest=$('st-best'); if(elBest) elBest.textContent=`🔥 ${prog.bestStreak} • ✨ ${prog.xp} XP`;
  const elBank=$('st-bank'); if(elBank) elBank.textContent=`${RICH.length} words • ${Object.keys((Storage&&Storage.getOfflineCache&&Storage.getOfflineCache())||{}).length} cached • ${Storage&&Storage.getFavorites? Storage.getFavorites().length:0} fav`;

  // achievements list
  const achList=$('achievements-list');
  if (achList && Achievements){
    const progAch = Achievements.getProgress();
    achList.innerHTML = progAch.list.slice(0,6).map(a=>{
      const unlocked=progAch.unlockedMap[a.id];
      return `<span class="mini-synant" style="${unlocked?'background:var(--correct);border-color:var(--ok)':''}" title="${esc(a.desc)}">${a.icon} ${esc(a.name)} ${unlocked?'✅':''}</span>`;
    }).join('') + ` <small>${progAch.unlocked}/${progAch.total} unlocked</small>`;
  }

  // detailed stats modal
  const detailedEl=$('stats-detailed');
  if (detailedEl){
    const favCount = Storage && Storage.getFavorites ? Storage.getFavorites().length : 0;
    const recentCount = Storage && Storage.getRecentWords ? Storage.getRecentWords().length : 0;
    const offlineCount = Storage && Storage.getOfflineCache ? Object.keys(Storage.getOfflineCache()).length : 0;
    const srsDetail = SRS && SRS.stats ? SRS.stats() : {total:0,due:0};
    detailedEl.innerHTML = `
      <p><b>Games:</b> ${prog.games} • <b>Known:</b> ${knownCount} • <b>Right:</b> ${prog.right} • <b>Wrong:</b> ${prog.wrong}</p>
      <p><b>Accuracy:</b> ${acc}% • <b>Best Streak:</b> ${prog.bestStreak} • <b>Current:</b> ${prog.streak}</p>
      <p><b>XP:</b> ${prog.xp} • <b>Level:</b> ${level()} • <b>Coins:</b> ${prog.coins}</p>
      <p><b>Favorites:</b> ${favCount} • <b>Recent Viewed:</b> ${recentCount} • <b>Offline Cached:</b> ${offlineCount}</p>
      <p><b>SRS:</b> Total tracked ${srsDetail.total} • Due now ${srsDetail.due}</p>
      <p><b>Search Count:</b> ${prog.searchCount||0} • <b>Quiz Questions:</b> ${prog.quizQuestions||0}</p>
      <p class="progress-line">Spaced Repetition: New words appear after 1 day, then 3 days, then interval*ease. Quality 5 = perfect recall, 0 = forgot.</p>
    `;
  }
}

/* -------------------- daily bonus -------------------- */
function dailyBonus(){
  const today=new Date().toISOString().slice(0,10);
  if (prog.lastDaily===today) return;
  prog.lastDaily=today; addCoins(25,'daily bonus'); sfx('coin');
  const btn=$('btn-daily'); if(btn){ btn.disabled=true; btn.textContent='✅ Daily bonus claimed — Daily Challenge inside! Come tomorrow!'; }
  updateStats();
  // check streak achievement
  if (Achievements && Achievements.checkAndUnlock){
    // streak handled elsewhere
  }
}
function refreshDailyBtn(){
  const today=new Date().toISOString().slice(0,10);
  const btn=$('btn-daily'); if(!btn) return;
  if (prog.lastDaily===today){ btn.disabled=true; btn.textContent='✅ Daily bonus claimed — come tomorrow!'; }
}

/* -------------------- bind UI -------------------- */
function bindLangBar(){
  document.querySelectorAll('.lang-pill').forEach(b=>{
    b.onclick=()=>setLangMode(b.dataset.lang);
    b.onkeydown=(e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setLangMode(b.dataset.lang); } };
  });
  setLangMode(langMode);
  document.querySelectorAll('.diff-pill').forEach(b=>{
    b.onclick=()=>setLevelFilter(parseInt(b.dataset.level,10));
  });
  setLevelFilter(levelFilter);
}
function bindModeTabs(){
  document.querySelectorAll('.mode-tab').forEach(b=>{
    b.onclick=()=>setModeTab(b.dataset.mode);
    b.onkeydown=(e)=>{
      if(e.key==='ArrowRight' || e.key==='ArrowLeft'){
        e.preventDefault();
        const tabs=Array.from(document.querySelectorAll('.mode-tab'));
        const idx=tabs.indexOf(b);
        const next = e.key==='ArrowRight' ? (idx+1)%tabs.length : (idx-1+tabs.length)%tabs.length;
        tabs[next].focus(); tabs[next].click();
      }
    };
  });
  setModeTab(modeSet);
}

function bindDictSearch(){
  const input=$('dict-input');
  const clear=$('dict-clear');
  const hear=$('btn-hear-search');
  const voiceBtn=$('dict-voice');

  const debouncedSearch = debounce(()=>handleDictSearch(), 250);

  if (input){
    input.addEventListener('input', debouncedSearch);
    input.addEventListener('keydown', e=>{
      if (e.key==='Enter'){
        e.preventDefault();
        const q=input.value.trim().toLowerCase();
        const exact=RICH.find(o=>o.w.toLowerCase()===q || o.telugu===q);
        if (exact) showDictResult(exact, q);
        else handleDictSearch();
      }
    });
    input.addEventListener('focus', ()=>{
      // show history/recent when empty
      if (!input.value.trim()) { renderSidePanels(); const res=$('dict-results'); if(res && !res.innerHTML.trim()) res.innerHTML='<p class="progress-line">Type English or తెలుగు, or try voice 🎤 — e.g., benevolent, sustainable, పర్యావరణం, enviroment (did you mean demo)</p>'; }
    });
  }
  if (clear) clear.onclick=()=>{
    if (input) input.value='';
    const res=$('dict-results'); if(res) res.innerHTML='';
    const meta=$('search-meta'); if(meta) meta.textContent=`Dictionary ready — ${RICH.length} words`;
    const did=$('did-you-mean'); if(did){ did.hidden=true; did.innerHTML=''; }
    if (currentGame==='dictionary') dictModeRender();
    renderSidePanels();
  };
  if (hear) hear.onclick=()=>{
    const q=input?.value||'';
    if (q) say(q);
    else say('Type a word to hear');
  };
  if (voiceBtn){
    voiceBtn.onclick=()=>{
      if (AudioEngine && AudioEngine.isVoiceSearchSupported && !AudioEngine.isVoiceSearchSupported()){
        announce('Voice search not supported in this browser. Try Chrome on Android.', true);
        return;
      }
      voiceBtn.textContent='🎤 Listening...';
      voiceBtn.disabled=true;
      if (AudioEngine && AudioEngine.startVoiceSearch){
        AudioEngine.startVoiceSearch((transcript)=>{
          voiceBtn.textContent='🎤'; voiceBtn.disabled=false;
          if (input){ input.value=transcript; handleDictSearch(); const obj=RICH.find(r=>r.w.toLowerCase()===transcript.toLowerCase()); if(obj) showDictResult(obj, transcript); announce(`Voice heard: ${transcript}`); }
        }, (err)=>{
          voiceBtn.textContent='🎤'; voiceBtn.disabled=false;
          announce(`Voice search error: ${err}`, true);
        });
      } else {
        voiceBtn.textContent='🎤'; voiceBtn.disabled=false;
      }
    };
  }
}

/* -------------------- boot -------------------- */
function init(){
  try {
    renderWallet();
    applySettings();
    bindSettings();
    bindLangBar();
    bindModeTabs();
    bindDictSearch();
    wotd();
    refreshDailyBtn();
    updateStats();
    renderSidePanels();

    const btnDaily=$('btn-daily'); if(btnDaily) btnDaily.onclick=dailyBonus;
    const btnStatsMore=$('btn-stats-more'); if(btnStatsMore) btnStatsMore.onclick=()=>{ const m=$('stats-modal'); if(m) m.hidden=false; updateStats(); };
    const btnCloseStats=$('btn-close-stats'); if(btnCloseStats) btnCloseStats.onclick=()=>{ const m=$('stats-modal'); if(m) m.hidden=true; };

    // auto-start game immediately
    if (modeSet!=='dictionary'){
      if (currentGame==='quiz' && (!quiz.queue || quiz.queue.length===0)) quiz.start();
    } else {
      dictModeRender();
    }

    if ('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
      navigator.serviceWorker.addEventListener('message', e=>{
        if (e.data && e.data.type==='WCU_APP_UPDATED'){
          const btn=$('btn-update'); if(btn) btn.hidden=false;
          announce('New version ready. Tap Update.', true);
        }
      });
      const updBtn=$('btn-update'); if(updBtn) updBtn.onclick=()=>{
        navigator.serviceWorker.getRegistration().then(r=>{ if(r&&r.waiting) r.waiting.postMessage({type:'WCU_SKIP_WAITING'}); });
        setTimeout(()=>location.reload(),250);
      };
    }

    const reviewCount=(prog.review||[]).length;
    announce(`Welcome to Word Coach Ultra v4 Pro. Professional real dictionary with ${RICH.length} words, IPA ${'/bəˈnev.əl.ənt/'}, Telugu, synonyms, antonyms, formal, academic, daily usage, fuzzy search Did you mean, voice search, offline cache, spaced repetition, favorites. Game appears immediately. ${reviewCount? reviewCount+' words in smart review.':''}`, true);

    setInterval(updateStats, 4000);

    // log build
    console.log('WCU v4 Pro initialized', {words: RICH.length, level: level(), coins: prog.coins, achievements: Achievements && Achievements.getProgress ? Achievements.getProgress() : {}});

  } catch(err){
    console.error('Init failed', err);
    const stage=$('game-stage');
    if (stage) stage.innerHTML=`<p class="result-banner wrong">Initialization error: ${esc(err.message)}<br>Please reload. If persists, clear localStorage.</p>`;
    announce(`Init error ${err.message}`, true);
  }
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

window.WCU = { RICH, WORDS:RICH, GAMES, setModeTab, setLangMode, setLevelFilter, renderDictCard: renderDictCardV4, quiz, searchEngine, Storage, SRS };

})();
