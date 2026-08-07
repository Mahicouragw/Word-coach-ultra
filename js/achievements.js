/* Word Coach Ultra — achievements.js
   Achievements, XP, Levels, Streak, Daily Challenge
   Classic — window.WCUAchievements
*/
(function(){
'use strict';
const ACHIEVEMENTS = [
  {id:'first_search', name:'First Search', desc:'Search a word in dictionary', icon:'🔍', xp:10},
  {id:'first_word', name:'First Word Learned', desc:'Answer first quiz correctly', icon:'🌱', xp:20},
  {id:'streak_3', name:'3-Day Streak', desc:'Maintain 3-day streak', icon:'🔥', xp:50},
  {id:'streak_7', name:'Week Warrior', desc:'7-day streak', icon:'🏆', xp:100},
  {id:'quiz_10', name:'Quiz Starter', desc:'Complete 10 quiz questions', icon:'❓', xp:30},
  {id:'quiz_perfect', name:'Perfect Score', desc:'Score 100% in a quiz', icon:'💯', xp:100},
  {id:'favorite_5', name:'Collector', desc:'Favorite 5 words', icon:'⭐', xp:30},
  {id:'review_10', name:'Dedicated Reviewer', desc:'Review 10 difficult words', icon:'🔁', xp:40},
  {id:'flash_20', name:'Flash Master', desc:'Complete 20 flashcards', icon:'🃏', xp:40},
  {id:'spelling_10', name:'Spelling Bee', desc:'Spell 10 words correctly', icon:'🐝', xp:50},
  {id:'chain_5', name:'Chain Builder', desc:'Build chain of 5 words', icon:'⛓️', xp:30},
  {id:'words_50', name:'Vocab Builder', desc:'Learn 50 words', icon:'📚', xp:100},
  {id:'daily_challenge', name:'Daily Challenger', desc:'Complete daily challenge', icon:'🎯', xp:50},
];

function loadAch(){
  try { return JSON.parse(localStorage.getItem('wcu_achievements_v4')||'{}'); } catch(e){ return {}; }
}
function saveAch(o){ try { localStorage.setItem('wcu_achievements_v4', JSON.stringify(o)); } catch(e){} }

function checkAndUnlock(id){
  const all = loadAch();
  if (all[id]) return false; // already unlocked
  all[id] = {unlocked: Date.now()};
  saveAch(all);
  // announce?
  if (window.WCUAudio) WCUAudio.sfx('coin');
  return true;
}

function getUnlocked(){
  return loadAch();
}

function getProgress(){
  const prog = loadAch();
  const total = ACHIEVEMENTS.length;
  const unlocked = Object.keys(prog).length;
  return {total, unlocked, percent: Math.round(unlocked/total*100), list: ACHIEVEMENTS, unlockedMap: prog};
}

function checkAll(progState, stats){
  // progState from main app prog
  // stats: right, wrong, known, etc.
  try {
    // first_search: handled in search
    if ((stats.searchCount||0)>=1) checkAndUnlock('first_search');
    if ((progState.right||0)>=1) checkAndUnlock('first_word');
    if ((progState.bestStreak||0)>=3) checkAndUnlock('streak_3');
    if ((progState.bestStreak||0)>=7) checkAndUnlock('streak_7');
    if ((stats.quizQuestions||0)>=10) checkAndUnlock('quiz_10');
    // quiz_perfect checked elsewhere
    // favorite_5
    const fav = window.WCUStorage ? WCUStorage.getFavorites().length : 0;
    if (fav>=5) checkAndUnlock('favorite_5');
    // etc.
  } catch(e){}
}

window.WCUAchievements = {
  list: ACHIEVEMENTS,
  checkAndUnlock, getUnlocked, getProgress, checkAll
};
})();
