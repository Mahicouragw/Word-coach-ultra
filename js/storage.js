/* Word Coach Ultra — storage.js
   Professional storage: recent searches, recent words, favorites,
   offline cache, search history, achievements, SRS, progress
   Classic — exposes window.WCUStorage
*/
(function(){
'use strict';
const KEYS = {
  recentSearches: 'wcu_recent_searches_v4',
  recentWords: 'wcu_recent_words_v4', // array of word strings
  favorites: 'wcu_favorites_v4',
  offlineCache: 'wcu_offline_cache_v4', // {word: entry}
  searchHistory: 'wcu_search_history_v4', // array of queries
  popularSearches: 'wcu_popular_searches_v4', // {query: count}
  achievements: 'wcu_achievements_v4',
  srs: 'wcu_srs_v4', // {word: {interval, ease, due, reps}}
  dailyChallenge: 'wcu_daily_challenge_v4',
  progress: 'wcu_progress_v1' // reuse existing
};

function load(key, def){
  try { const v = localStorage.getItem(key); return v? JSON.parse(v): def; } catch(e){ return def; }
}
function save(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

const Storage = {
  // recent searches (queries)
  getRecentSearches(){ return load(KEYS.recentSearches, []); },
  addRecentSearch(q){
    if (!q || q.trim().length<2) return;
    q=q.trim();
    let arr = load(KEYS.recentSearches, []);
    arr = arr.filter(x=>x.toLowerCase()!==q.toLowerCase());
    arr.unshift(q);
    if (arr.length>20) arr=arr.slice(0,20);
    save(KEYS.recentSearches, arr);
    // also history for popular counting
    this.addSearchHistory(q);
  },
  // recent words (viewed)
  getRecentWords(){ return load(KEYS.recentWords, []); },
  addRecentWord(word){
    if (!word) return;
    const key = String(word).toLowerCase();
    let arr = load(KEYS.recentWords, []);
    arr = arr.filter(x=>String(x).toLowerCase()!==key);
    arr.unshift(word);
    if (arr.length>30) arr=arr.slice(0,30);
    save(KEYS.recentWords, arr);
  },
  // favorites
  getFavorites(){ return load(KEYS.favorites, []); },
  isFavorite(word){
    const k = String(word).toLowerCase();
    return load(KEYS.favorites, []).some(w=>String(w).toLowerCase()===k);
  },
  toggleFavorite(word){
    let arr = load(KEYS.favorites, []);
    const k = String(word).toLowerCase();
    const idx = arr.findIndex(w=>String(w).toLowerCase()===k);
    if (idx>=0) arr.splice(idx,1);
    else arr.unshift(word);
    if (arr.length>200) arr=arr.slice(0,200);
    save(KEYS.favorites, arr);
    return idx<0; // true if added
  },
  // offline cache
  getOfflineCache(){ return load(KEYS.offlineCache, {}); },
  cacheEntry(word, entry){
    if (!word || !entry) return;
    let cache = load(KEYS.offlineCache, {});
    cache[String(word).toLowerCase()] = {entry, ts: Date.now()};
    // limit 200 entries
    const keys = Object.keys(cache);
    if (keys.length>200){
      // remove oldest
      const sorted = keys.map(k=>({k, ts: cache[k].ts||0})).sort((a,b)=>a.ts-b.ts);
      for (let i=0;i<keys.length-200;i++) delete cache[sorted[i].k];
    }
    save(KEYS.offlineCache, cache);
  },
  getCachedEntry(word){
    const cache = load(KEYS.offlineCache, {});
    const e = cache[String(word).toLowerCase()];
    return e? e.entry: null;
  },
  // search history
  getSearchHistory(){ return load(KEYS.searchHistory, []); },
  addSearchHistory(q){
    if (!q) return;
    q=q.trim();
    let arr = load(KEYS.searchHistory, []);
    arr.unshift({q, ts: Date.now()});
    if (arr.length>100) arr=arr.slice(0,100);
    save(KEYS.searchHistory, arr);
    // popular
    let pop = load(KEYS.popularSearches, {});
    const key = q.toLowerCase();
    pop[key] = (pop[key]||0)+1;
    save(KEYS.popularSearches, pop);
  },
  getPopularSearches(limit=10){
    const pop = load(KEYS.popularSearches, {});
    return Object.entries(pop).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([q,c])=>({query:q, count:c}));
  },
  clearHistory(){
    save(KEYS.recentSearches, []);
    save(KEYS.searchHistory, []);
  },
  // SRS (spaced repetition) — simple SM-2 light
  getSRS(){ return load(KEYS.srs, {}); },
  updateSRS(word, quality){ // quality 0-5, 5 perfect, 0 fail
    const key = String(word).toLowerCase();
    let data = load(KEYS.srs, {});
    let entry = data[key] || {interval:0, ease:2.5, due: Date.now(), reps:0};
    if (quality <3){
      entry.reps=0;
      entry.interval=1; // 1 day
    } else {
      if (entry.reps===0) entry.interval=1;
      else if (entry.reps===1) entry.interval=3;
      else entry.interval = Math.round(entry.interval * entry.ease);
      entry.reps +=1;
      // adjust ease
      entry.ease = Math.max(1.3, entry.ease + (0.1 - (5-quality)*(0.08 + (5-quality)*0.02)));
    }
    entry.due = Date.now() + entry.interval*24*60*60*1000;
    data[key]=entry;
    save(KEYS.srs, data);
    return entry;
  },
  getDueWords(allWords){
    const srs = load(KEYS.srs, {});
    const now = Date.now();
    const due = [];
    for (const w of allWords){
      const key = String(w.w).toLowerCase();
      const e = srs[key];
      if (!e || e.due <= now) due.push(w);
    }
    return due;
  },
  // daily challenge
  getDailyChallenge(){
    return load(KEYS.dailyChallenge, null);
  },
  setDailyChallenge(obj){ save(KEYS.dailyChallenge, obj); },
  // achievements handled separately but storage here
  getAchievements(){ return load(KEYS.achievements, {}); },
  setAchievements(obj){ save(KEYS.achievements, obj); }
};

window.WCUStorage = Storage;
})();
