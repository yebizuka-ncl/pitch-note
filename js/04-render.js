"use strict";
/* =========================================================
   4. 描画：共通
   ========================================================= */
const TITLES = { post:['試合後','FULL TIME'], teams:['チームを選ぶ','SELECT TEAM'], home:['ホーム','MATCH DAY'], roster:['選手リスト','SQUAD'], record:['試合記録','LIVE'], data:['データ・AI分析','ANALYSIS'] };
function render(){
  const s = state.ui.screen;
  document.body.dataset.screen = s;
  applyTheme();
  document.querySelectorAll('[data-nav]').forEach(b => b.setAttribute('aria-current', b.dataset.nav === s ? 'page' : 'false'));
  $('#screenTitle').textContent = TITLES[s][0]; $('#screenEng').textContent = TITLES[s][1];
  const n = unsynced().length;
  const sb = $('#syncBadge'); if(sb){ sb.textContent = n; sb.classList.toggle('zero', n === 0); }
  const nv = $('#navVer'); if(nv) nv.textContent = APP_VER_LABEL;
  trackNav();
  $('#main').innerHTML = ({ teams:viewTeams, home:viewHome, roster:viewRoster, record:viewRecord, data:viewData, post:viewPost })[s]();
  updateClock(); renderPop(); keepAwake();
  if(s === 'post' || state.ui.flow?.kind === 'match') centerWheels(document);
}
function pitchSVG(){
  const stripes = Array.from({length:12}, (_,i) => i%2 ? `<rect x="${i*8.75}" y="0" width="8.75" height="68" fill="var(--pitch-b)"/>` : '').join('');
  return `<svg viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
    <rect width="105" height="68" fill="var(--pitch-a)"/>${stripes}
    <g fill="none" stroke="var(--chalk-soft)" stroke-width=".3" stroke-dasharray="1.2 1.2"><path d="M35 0v68M70 0v68M0 13.84h105M0 24.84h105M0 43.16h105M0 54.16h105"/></g>
    <g fill="none" stroke="var(--chalk)" stroke-width=".45">
      <rect x=".6" y=".6" width="103.8" height="66.8"/><path d="M52.5 .6v66.8"/><circle cx="52.5" cy="34" r="9.15"/>
      <rect x=".6" y="13.84" width="16.5" height="40.32"/><rect x=".6" y="24.84" width="5.5" height="18.32"/>
      <rect x="87.9" y="13.84" width="16.5" height="40.32"/><rect x="98.9" y="24.84" width="5.5" height="18.32"/>
      <path d="M17.1 26.7a9.15 9.15 0 0 1 0 14.6M87.9 26.7a9.15 9.15 0 0 0 0 14.6"/>
    </g>
    <g fill="var(--chalk)"><circle cx="52.5" cy="34" r=".5"/><circle cx="11" cy="34" r=".5"/><circle cx="94" cy="34" r=".5"/></g>
  </svg>`;
}
const pct = (v, total) => (v / total * 100).toFixed(3) + '%';
// 表示用の座標変換（陣地が左のピリオドは180°回転）
const D = (x, y, flip) => flip ? [105 - x, 68 - y] : [x, y];
function rectStyle(x0, y0, w, h, flip){
  const [x, y] = flip ? [105 - x0 - w, 68 - y0 - h] : [x0, y0];
  return `left:${pct(x,105)};top:${pct(y,68)};width:${pct(w,105)};height:${pct(h,68)}`;
}
function pitchHTML({ tap=false, dots=[], pos=null, flip=false }){
  let hl = '';
  if(tap){ const z = pos ? zoneOf(pos.x, pos.y) : null, [px, py] = pos ? D(pos.x, pos.y, flip) : [0, 0];
    hl = `<div class="zhl" id="zoneHl" ${pos ? `style="${rectStyle(THIRD_X[z.ti], LANE_Y[z.li], 35, LANE_Y[z.li+1]-LANE_Y[z.li], flip)}"` : 'hidden'}></div>
          <span class="pos" id="posMarker" style="left:${pct(px,105)};top:${pct(py,68)}" ${pos ? '' : 'hidden'}></span>`; }
  const thirds = flip ? THIRDS.slice().reverse() : THIRDS;
  return `<div class="thirds-head">${thirds.map(t => `<span>${t.name}</span>`).join('')}</div>
  <div class="pitch" ${tap ? `data-tap data-flip="${flip ? 1 : 0}"` : ''}>${pitchSVG()}
    <div class="vital" style="${rectStyle(70, 13.84, 35, 40.32, flip)}"><b>バイタルエリア</b></div>
    ${LANES.map((l,i) => { const y = (LANE_Y[i]+LANE_Y[i+1])/2; return `<span class="lane-lb" style="top:${pct(flip ? 68 - y : y,68)}">${l.short}</span>`; }).join('')}
    ${hl}
    ${dots.map(e => { const [x, y] = D(e.x, e.y, flip); return `<span class="sdot ${e.team} r-${e.result}" style="left:${pct(x,105)};top:${pct(y,68)}"></span>`; }).join('')}
    <div class="dir">${flip ? '◀ ATTACK' : 'ATTACK ▶'}</div>
  </div>`;
}
const shotLegend = (usName, themName) => `<div class="legend">
  <span><i class="sw" style="background:var(--kit-hi)"></i>${esc(usName)}</span><span><i class="sw" style="background:var(--opp)"></i>${esc(themName)}</span>
  <span><span class="sdot us static r-goal"></span>ゴール</span><span><span class="sdot us static r-on"></span>枠内</span>
  <span><span class="sdot us static r-off"></span>枠外</span><span><span class="sdot us static r-block"></span>ブロック</span></div>`;

