/* Word Coach Ultra — audio.js
   Audio engine: TTS, pronunciation, sounds, voice search
   Classic — exposes window.WCUAudio
*/
(function(){
'use strict';
let settings = { tts:true, rate:1.0, sounds:true };
try { settings = Object.assign(settings, JSON.parse(localStorage.getItem('wcu_settings_v1')||'{}')); } catch(e){}

let audioCtx=null;
const SFX_FILES = { good:'sounds/ui-good.ogg', bad:'sounds/ui-bad.ogg', coin:'sounds/ui-coin.ogg', flip:'sounds/ui-flip.ogg', click:'sounds/ui-click.ogg' };
const sfxCache={};

function sfx(kind){
  if (!settings.sounds) return;
  const url = SFX_FILES[kind]||SFX_FILES.click;
  try {
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    if (audioCtx.state==='suspended') audioCtx.resume();
    const play = (buf)=>{
      const src=audioCtx.createBufferSource(); src.buffer=buf;
      const g=audioCtx.createGain(); g.gain.value=0.5;
      src.connect(g).connect(audioCtx.destination); src.start(0);
    };
    if (sfxCache[url]) { play(sfxCache[url]); return; }
    fetch(url).then(r=>r.arrayBuffer()).then(b=>audioCtx.decodeAudioData(b)).then(d=>{sfxCache[url]=d; play(d);}).catch(()=>{});
  } catch(e){}
}

function clean(t){ return String(t||'').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu,'').replace(/\s+/g,' ').trim(); }

function say(text, slow){
  if (!settings.tts || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); } catch(e){}
  const u = new SpeechSynthesisUtterance(clean(text).slice(0,900));
  u.rate = (settings.rate||1)*(slow?0.75:1);
  try {
    const vs = speechSynthesis.getVoices();
    const en = vs.find(v=>v.lang && v.lang.toLowerCase().startsWith('en'));
    if (en) u.voice=en;
  } catch(e){}
  speechSynthesis.speak(u);
}

function sayWithIPA(wordObj){
  if (!wordObj) return;
  const text = `${wordObj.w}. ${wordObj.ipa||''}. ${wordObj.meaning}. Telugu ${wordObj.telugu}. Example ${wordObj.examples&&wordObj.examples[0]||''}`;
  say(text, false);
}

// Voice search support using Web Speech API
let recognition=null;
function isVoiceSearchSupported(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
function startVoiceSearch(onResult, onError){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ if(onError) onError('Voice search not supported'); return null; }
  try {
    recognition = new SR();
    recognition.lang = 'en-US'; // could be mixed? start with en
    recognition.interimResults=false;
    recognition.maxAlternatives=3;
    recognition.onresult = (e)=>{
      const transcript = e.results[0][0].transcript;
      if (onResult) onResult(transcript, e.results[0]);
    };
    recognition.onerror = (e)=>{ if(onError) onError(e.error||'voice error'); };
    recognition.onend = ()=>{ recognition=null; };
    recognition.start();
    return recognition;
  } catch(err){ if(onError) onError(err.message); return null; }
}
function stopVoiceSearch(){
  try { if(recognition){ recognition.stop(); recognition=null; } } catch(e){}
}

window.WCUAudio = {
  sfx, say, sayWithIPA, isVoiceSearchSupported, startVoiceSearch, stopVoiceSearch
};
})();
