/* Word Coach Ultra — utils.js
   Professional utilities: normalize, Levenshtein, debounce, highlight, etc.
   Classic script — exposes window.WCUUtils
*/
(function(){
'use strict';
function normalize(str) {
  if (!str) return '';
  // NFD to strip diacritics, lower, trim, remove extra spaces
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function stripAccents(str){ return normalize(str); }

function levenshtein(a,b) {
  a = normalize(a); b = normalize(b);
  if (a===b) return 0;
  if (a.length===0) return b.length;
  if (b.length===0) return a.length;
  // optimization for long strings
  if (Math.abs(a.length-b.length)>4) {
    // quick check: if length diff > max allowed, return large
    // but we still compute for did-you-mean, so continue
  }
  const m = a.length, n = b.length;
  // use two rows to save memory
  let prev = new Array(n+1);
  let curr = new Array(n+1);
  for (let j=0;j<=n;j++) prev[j]=j;
  for (let i=1;i<=m;i++) {
    curr[0]=i;
    const ai = a[i-1];
    for (let j=1;j<=n;j++) {
      const cost = ai===b[j-1]?0:1;
      curr[j]=Math.min(
        prev[j]+1,      // deletion
        curr[j-1]+1,    // insertion
        prev[j-1]+cost  // substitution
      );
    }
    const tmp=prev; prev=curr; curr=tmp;
  }
  return prev[n];
}

function debounce(fn, delay){
  let t=null;
  return function(...args){
    clearTimeout(t);
    t=setTimeout(()=>fn.apply(this,args), delay);
  };
}

function escapeHtml(s){
  const d=document.createElement('div'); d.textContent=s; return d.innerHTML;
}

function highlightMatch(text, query){
  if (!query) return escapeHtml(text);
  const normText = normalize(text);
  const normQ = normalize(query);
  if (!normQ) return escapeHtml(text);
  // find index of query in normalized text, then map back to original (approx)
  // For simplicity, highlight case-insensitive substring in original using regex
  try {
    const escapedQ = normQ.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp(`(${escapedQ})`,'ig');
    // Use original text but highlight
    return escapeHtml(text).replace(re, '<mark>$1</mark>');
  } catch(e){
    return escapeHtml(text);
  }
}

function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]); }

function isTeluguChar(ch){
  const code = ch.charCodeAt(0);
  // Telugu block 0C00-0C7F
  return code>=0x0C00 && code<=0x0C7F;
}
function containsTelugu(str){
  for (let i=0;i<str.length;i++) if (isTeluguChar(str[i])) return true;
  return false;
}

window.WCUUtils = {
  normalize, stripAccents, levenshtein, debounce, escapeHtml, highlightMatch, shuffle,
  isTeluguChar, containsTelugu
};
})();
