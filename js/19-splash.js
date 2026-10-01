"use strict";
/* =========================================================
   19. 起動のエフェクト（案I：シンプル＋ピッチライン）
   ピッチの線がうすく見えていて、ロゴが出るのに合わせて消えていく。約1.3秒。
   - 画面に触れるとすぐ終わる
   - 記録中の試合があるときは出さない（すぐ記録に戻れるように）
   - ⚙ 設定で「その日はじめてだけ（初期）／毎回／出さない」を選べる
   ========================================================= */
const SPLASH_MODES = [{ id:'daily', label:'その日はじめてだけ' }, { id:'always', label:'毎回' }, { id:'off', label:'出さない' }];
const splashMode = () => state.meta.settings?.splash || 'daily';

function splashHTML(){
  const k = team()?.kits?.[1] || DEFAULT_KITS[1];
  return `<div class="spl" id="splash" role="presentation">
    <svg class="spl-lines" viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="103" height="66" pathLength="100"/><path d="M52.5 1V67" pathLength="100"/>
      <circle cx="52.5" cy="34" r="9.15" pathLength="100"/><path d="M1 13.84H17.1V54.16H1M104 13.84H87.9V54.16H104" pathLength="100"/>
      <path d="M1 24.84H6.6V43.16H1M104 24.84H98.4V43.16H104" pathLength="100"/></svg>
    <div class="spl-lockup">${logoMark(k.a, k.b)}<div class="spl-wm"><small>KAMAGAKU</small><b>MATCH <i>LOG</i></b></div></div>
    <span class="spl-under" style="background:linear-gradient(90deg,${k.a},${k.b})"></span>
  </div>`;
}
function hideSplash(fast){
  const el = $('#splash'); if(!el || el.dataset.out) return;
  el.dataset.out = '1'; clearTimeout(hideSplash.t);
  el.classList.add(fast ? 'out-fast' : 'out');
  setTimeout(() => el.remove(), fast ? 160 : 380);
}
function showSplash(){
  const mode = splashMode();
  if(mode === 'off' || liveNow()) return;
  const d = today();
  if(mode === 'daily' && state.meta.splashDay === d) return;
  state.meta.splashDay = d; save.meta();
  document.body.insertAdjacentHTML('beforeend', splashHTML());
  const el = $('#splash');
  el.addEventListener('pointerdown', () => hideSplash(true), { once:true });
  hideSplash.t = setTimeout(() => hideSplash(false), matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 1300);
}
// ⚙ 設定の行
function splashSettingHTML(){
  return `<div class="setrow lvrow"><span><b>起動のエフェクト</b><small>アプリを開いたときのロゴの動き。画面に触れるとすぐ終わります。記録中の試合があるときは出ません</small></span>
    <div class="lvseg" role="group" aria-label="起動のエフェクト">${SPLASH_MODES.map(m => `<button type="button" data-setsplash="${m.id}" aria-pressed="${splashMode() === m.id}"><b>${m.label}</b></button>`).join('')}</div></div>`;
}
$('#sheet').addEventListener('click', e => {
  const b = e.target.closest('[data-setsplash]'); if(!b) return;
  state.meta.settings.splash = b.dataset.setsplash; save.meta();
  document.querySelectorAll('[data-setsplash]').forEach(x => x.setAttribute('aria-pressed', x === b));
  if(b.dataset.setsplash !== 'off'){ state.meta.splashDay = null; toast('次にアプリを開いたときから出ます'); }
});
