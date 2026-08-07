/* Word Coach Ultra — search.js
   Intelligent search with prefix, suffix, contains, fuzzy (Levenshtein),
   Did you mean, highlighting, voice search support
   Classic — exposes window.WCUSearch
*/
(function(){
'use strict';
const Utils = (typeof window!=='undefined' && window.WCUUtils) ? window.WCUUtils : { normalize: s=>String(s).toLowerCase().trim(), levenshtein: (a,b)=>Math.abs(a.length-b.length), highlightMatch: (t)=>t, containsTelugu: ()=>false };
const Storage = (typeof window!=='undefined' && window.WCUStorage) ? window.WCUStorage : null;

function normalize(s){
  try {
    if (typeof window!=='undefined' && window.WCUUtils && window.WCUUtils.normalize) return window.WCUUtils.normalize(s);
    if (Utils && Utils.normalize) return Utils.normalize(s);
  } catch(e){}
  return String(s||'').toLowerCase().trim();
}

class SearchEngine {
  constructor(words){
    this.words = words || [];
    this.buildIndex();
  }
  buildIndex(){
    // Precompute normalized forms for fast search
    this.index = this.words.map(w=>{
      const en = normalize(w.w||'');
      const te = normalize(w.telugu||'');
      const teMean = normalize(w.teluguMeaning||'');
      const mean = normalize(w.meaning||'');
      const all = `${en} ${te} ${teMean} ${mean} ${(w.synonyms||[]).map(s=>s.en).join(' ')} ${(w.antonyms||[]).map(a=>a.en).join(' ')} ${(w.collocations||[]).join(' ')}`.trim();
      return {obj:w, en, te, teMean, mean, all};
    });
    // For prefix trie we can sort by en
    this.sortedByEn = [...this.index].sort((a,b)=>a.en.localeCompare(b.en));
  }

  // Core search
  search(query, opts={}){
    const qRaw = (query||'').trim();
    let q = '';
    try { q = normalize(qRaw); } catch(e){ q = String(qRaw).toLowerCase().trim(); }
    const limit = opts.limit || 30;
    if (!q || q.length<1){
      return {results:[], suggestions:[], didYouMean:[], isEmpty:true};
    }

    // Exact, prefix, suffix, contains scoring
    let scored = [];
    for (const entry of this.index){
      const {obj, en, te, teMean, mean, all} = entry;
      let score = 0;
      let matchType = null;

      // Exact match English or Telugu
      if (en===q || te===q){ score=1000; matchType='exact'; }
      else if (en.startsWith(q) || te.startsWith(q)){ score=900; matchType='prefix'; }
      else if (en.endsWith(q) || te.endsWith(q)){ score=700; matchType='suffix'; }
      else if (all.includes(q)){ score=500; matchType='contains'; }
      else {
        // check if query is Telugu and matches teluguMeaning contains
        if (teMean.includes(q)) { score=400; matchType='contains_te'; }
      }

      if (score>0){
        scored.push({obj, score, matchType, en, te});
      }
    }

    // Sort by score then by frequency (common first) and length (shorter first for relevance)
    scored.sort((a,b)=>{
      if (b.score!==a.score) return b.score-a.score;
      // prefer common words
      const freqOrder = { 'very common':0, 'common':1, 'medium':2, 'rare':3 };
      const fa = freqOrder[a.obj.frequency] ?? 2;
      const fb = freqOrder[b.obj.frequency] ?? 2;
      if (fa!==fb) return fa-fb;
      return a.en.length - b.en.length;
    });

    let results = scored.slice(0, limit).map(s=>s.obj);

    // If few results, try fuzzy (Did you mean)
    let didYouMean = [];
    if (results.length<3){
      const fuzzyCandidates = [];
      // compute edit distance for all words where length difference not huge
      for (const entry of this.index){
        const {obj, en} = entry;
        // skip if already in results
        if (results.includes(obj)) continue;
        // length filter: if len diff >3 skip for performance, but allow for longer queries
        if (Math.abs(en.length - q.length)>4 && q.length<6) continue;
        const dist = Utils.levenshtein(en, q);
        // also check Telugu edit distance if query contains Telugu chars
        let teDist = Infinity;
        if (Utils.containsTelugu && Utils.containsTelugu(qRaw)){
          teDist = Utils.levenshtein(entry.te, q);
        }
        const bestDist = Math.min(dist, teDist);
        // threshold based on query length
        const threshold = q.length<=4 ? 1 : q.length<=7 ? 2 : 3;
        if (bestDist<=threshold){
          fuzzyCandidates.push({obj, dist:bestDist});
        }
      }
      fuzzyCandidates.sort((a,b)=>a.dist-b.dist);
      didYouMean = fuzzyCandidates.slice(0,5).map(c=>c.obj);
      // If still no results, use didYouMean as results? No, keep didYouMean separate for UI "Did you mean"
      if (results.length===0 && didYouMean.length>0){
        // promote top fuzzy as results if no exact
        results = didYouMean.slice(0, limit);
        didYouMean = []; // since we used them as results, clear or keep next
      }
    }

    // Suggestions: based on prefix from sorted list (autocomplete)
    let suggestions = [];
    if (q.length>=1){
      // find words starting with q
      suggestions = this.sortedByEn.filter(e=>e.en.startsWith(q)).slice(0,8).map(e=>e.obj);
    }

    return {results, suggestions, didYouMean, query: qRaw};
  }

  // Did you mean with multiple possibilities
  getDidYouMean(query, max=3){
    const q = normalize(query);
    if (!q) return [];
    let cands=[];
    for (const entry of this.index){
      const dist = Utils.levenshtein(entry.en, q);
      if (dist<=3 && dist>0){
        cands.push({obj:entry.obj, dist});
      }
    }
    cands.sort((a,b)=>a.dist-b.dist);
    return cands.slice(0,max).map(c=>c.obj);
  }

  highlight(text, query){
    return Utils.highlightMatch(text, query);
  }
}

window.WCUSearchEngine = SearchEngine;
window.WCUSearch = {
  Engine: SearchEngine,
  // singleton helper
  create(words){ return new SearchEngine(words); }
};
})();
