/* Word Coach Ultra — srs.js (spaced repetition)
   Simple SM-2 implementation for smart revision
   Classic — window.WCUSRS
*/
(function(){
'use strict';
const Storage = window.WCUStorage;

const SRS = {
  update(word, quality){
    if (!Storage) return null;
    return Storage.updateSRS(word, quality);
  },
  getDueWords(all){
    if (!Storage) return all;
    return Storage.getDueWords(all);
  },
  stats(){
    if (!Storage) return {total:0, due:0};
    const all = Storage.getSRS();
    const keys = Object.keys(all);
    const now = Date.now();
    let due=0;
    for (const k of keys){
      if (all[k].due <= now) due++;
    }
    return {total: keys.length, due};
  }
};

window.WCUSRS = SRS;
})();
