"use strict";
/* =========================================================
   16. Apple Pencil で描く（CK・FKの作図／得点までの流れ／作戦ボード）
       ＋ PKのコース・時間帯別の集計・動画の目次
   作図データ sketch = { view:'full'|'halfUs'|'halfThem', items:[…], fm? }
     items: { k:'s', t:'ball'|'runUs'|'runThem'|'free', p:[[x,y],…] }  … 線（ピッチ座標：自チームが右へ攻める向き）
            { k:'d', t:'us'|'them', x, y }                              … 選手の位置
            { k:'b', x, y }                                             … ボールの出発点（CKのコーナー・FKの位置・シュート位置）
   ========================================================= */
const SK_VIEWS = {
  full:     { vb:'0 0 105 68',      x0:0,  y0:0,    w:105, h:68,   toP:(X, Y) => [X, Y],        fromP:(x, y) => [x, y] },
  halfUs:   { vb:'-2 -3.5 72 58',   x0:-2, y0:-3.5, w:72,  h:58,   toP:(X, Y) => [105 - Y, X],  fromP:(x, y) => [y, 105 - x] },
  halfThem: { vb:'-2 -3.5 72 58',   x0:-2, y0:-3.5, w:72,  h:58,   toP:(X, Y) => [Y, 68 - X],   fromP:(x, y) => [68 - y, x] },
};
const SK_TOOLS = [
  { id:'move',    label:'動かす',     sub:'選手・ボールをドラッグ' },
  { id:'ball',    label:'ボール',     sub:'実線＋矢印' },
  { id:'runUs',   label:'味方の動き', sub:'点線＋矢印' },
  { id:'runThem', label:'相手の動き', sub:'点線＋矢印' },
  { id:'dotUs',   label:'味方の位置', sub:'タップで置く' },
  { id:'dotThem', label:'相手の位置', sub:'タップで置く' },
  { id:'free',    label:'ペン',       sub:'自由に書く' },
];
const SK_STYLE = {
  ball:    { c:'#ffffff',       w:.62, dash:'',        arrow:true },
  runUs:   { c:'var(--kit-hi)', w:.55, dash:'1.5 1.1', arrow:true },
  runThem: { c:'var(--opp)',    w:.55, dash:'1.5 1.1', arrow:true },
  free:    { c:'#ffd600',       w:.45, dash:'',        arrow:false },
};
const r1 = v => Math.round(v * 10) / 10;
const Sketch = { penSeen:false, cur:null };

/* ---------- 描画（画面・レポート共通の SVG） ---------- */
function halfPitchInner(){
  const stripes = [0,1,2,3,4,5].map(i => i % 2 ? `<rect x="0" y="${i * 8.75}" width="68" height="8.75" fill="var(--pitch-b)"/>` : '').join('');
  return `<rect x="-2" y="-3.5" width="72" height="58" fill="var(--pitch-a)"/>${stripes}
    <g fill="none" stroke="var(--chalk-soft)" stroke-width=".3" stroke-dasharray="1.2 1.2"><path d="M13.84 0v52.5M24.84 0v52.5M43.16 0v52.5M54.16 0v52.5M0 35h68"/></g>
    <g fill="none" stroke="var(--chalk)" stroke-width=".45">
      <rect x="0" y="0" width="68" height="52.5"/><rect x="13.84" y="0" width="40.32" height="16.5"/><rect x="24.84" y="0" width="18.32" height="5.5"/>
      <path d="M26.69 16.5A9.15 9.15 0 0 0 41.31 16.5"/><path d="M24.85 52.5A9.15 9.15 0 0 1 43.15 52.5"/>
      <path d="M1 0A1 1 0 0 1 0 1M67 0A1 1 0 0 0 68 1"/><rect x="30.34" y="-2" width="7.32" height="2"/>
    </g>
    <g fill="var(--chalk)"><circle cx="34" cy="11" r=".5"/><circle cx="34" cy="52.5" r=".5"/></g>`;
}
const fullPitchInner = () => pitchSVG().replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
function skPath(pts){
  if(pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for(let i = 1; i < pts.length - 1; i++){
    const mx = (pts[i][0] + pts[i+1][0]) / 2, my = (pts[i][1] + pts[i+1][1]) / 2;
    d += `Q${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const l = pts[pts.length - 1];
  return d + `L${l[0].toFixed(2)} ${l[1].toFixed(2)}`;
}
function skArrow(pts, c, size){
  const e = pts[pts.length - 1]; let b = pts[0];
  for(let i = pts.length - 2; i >= 0; i--){ if(Math.hypot(e[0] - pts[i][0], e[1] - pts[i][1]) >= 1.6){ b = pts[i]; break; } }
  const a = Math.atan2(e[1] - b[1], e[0] - b[0]), s = size;
  const p1 = [e[0] - s * Math.cos(a - .45), e[1] - s * Math.sin(a - .45)], p2 = [e[0] - s * Math.cos(a + .45), e[1] - s * Math.sin(a + .45)];
  return `<polygon points="${e[0].toFixed(2)},${e[1].toFixed(2)} ${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}" fill="${c}"/>`;
}
function skItemSVG(it, V, faint, idx){
  const hit = idx != null ? `data-it="${idx}"` : '';
  if(it.k === 'd'){ const [X, Y] = V.fromP(it.x, it.y);
    return `<circle ${hit} cx="${X.toFixed(2)}" cy="${Y.toFixed(2)}" r="1.55" fill="${it.t === 'us' ? 'var(--kit-hi)' : 'var(--opp)'}" stroke="#fff" stroke-width=".35"/>`; }
  if(it.k === 'b'){ const [X, Y] = V.fromP(it.x, it.y);
    return `<circle ${hit} cx="${X.toFixed(2)}" cy="${Y.toFixed(2)}" r="1.05" fill="#fff" stroke="#111" stroke-width=".3"/>`; }
  const st = SK_STYLE[it.t] || SK_STYLE.free, pts = it.p.map(q => V.fromP(q[0], q[1]));
  if(pts.length < 2) return '';
  return `<g opacity="${faint ? .6 : 1}"><path d="${skPath(pts)}" fill="none" stroke="${st.c}" stroke-width="${st.w}" stroke-linecap="round" stroke-linejoin="round" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>${st.arrow ? skArrow(pts, st.c, 1.7) : ''}</g>`;
}
function skFmLayer(fm, V){
  if(!fm) return '';
  const side = t => { const f = fm[t]; if(!f?.shape) return '';
    return slotsOf(f.shape, t).map((s, i) => { const q = f.pos?.[i] || [s.x, s.y], [X, Y] = V.fromP(q[0], q[1]), n = f.nums?.[i];
      return `<g opacity=".95" data-pl="${t}:${i}"><circle cx="${X.toFixed(2)}" cy="${Y.toFixed(2)}" r="3.4" fill="transparent"/><circle cx="${X.toFixed(2)}" cy="${Y.toFixed(2)}" r="2" fill="${t === 'us' ? 'var(--kit)' : 'rgba(0,0,0,.35)'}" stroke="${t === 'us' ? 'var(--accent)' : 'var(--opp)'}" stroke-width=".4"/>
        <text x="${X.toFixed(2)}" y="${(Y + .8).toFixed(2)}" text-anchor="middle" font-size="${n != null ? 2.2 : 1.5}" font-weight="800" fill="${t === 'us' ? '#fff' : 'var(--opp)'}" pointer-events="none">${n != null ? n : s.label}</text></g>`; }).join(''); };
  return side('us') + side('them');
}
function sketchSVG(sk, o = {}){
  const V = SK_VIEWS[sk?.view] || SK_VIEWS.full;
  const bg = sk?.view === 'full' || !sk?.view ? fullPitchInner() : halfPitchInner();
  const items = (sk?.items || []).map((it, i) => skItemSVG(it, V, o.faint, o.edit ? i : null)).join('');
  return `<svg ${o.edit ? 'id="skSvg"' : ''} class="sksvg ${o.cls || ''}" viewBox="${V.vb}" preserveAspectRatio="xMidYMid meet" ${o.edit ? '' : 'aria-hidden="true"'}>
    ${bg}<g ${o.edit ? 'id="skFm"' : ''}>${skFmLayer(sk?.fm, V)}</g><g ${o.edit ? 'id="skItems"' : ''}>${items}</g>${o.edit ? '<path id="skLive" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;
}
const hasDrawing = sk => !!(sk?.items?.some(i => i.k === 's' || i.k === 'd') || sk?.fm?.us?.pos || sk?.fm?.them?.pos);

/* ---------- 作図シート ---------- */
function openSketch(o){
  state.ui.flow = { kind:'sketch', o, sk:structuredClone(o.sketch), tool:o.tool || state.ui.skTool || 'ball' };
  renderSketchSheet();
}
function renderSketchSheet(){
  const f = state.ui.flow, o = f.o;
  openSheet(`<div class="skhead"><h2>${o.title}</h2><span class="muted">${o.sub || ''}</span></div>
    <div class="skwrap">
      <div class="skboard ${f.sk.view === 'full' ? 'full' : 'half'}">${sketchSVG(f.sk, { edit:true })}
        ${f.sk.view === 'full' ? `<span class="skdir">${esc(o.dirLabel || '自チームの攻撃 ▶')}</span>` : '<span class="skdir">▲ ゴール（キッカーから見た向き）</span>'}</div>
      <div class="sktools">
        <div class="sktgrid">${SK_TOOLS.map(t => `<button type="button" class="skt ${t.id}" data-sktool="${t.id}" aria-pressed="${f.tool === t.id}"><i></i><b>${t.label}</b><small>${t.sub}</small></button>`).join('')}</div>
        <div class="skrow"><button class="btn small" data-skundo type="button">↶ 1つ戻す</button><button class="btn small" data-skclear type="button">全部消す</button></div>
        <p class="skhint">✍️ Apple Pencilで描けます（指でもOK）。ペンを一度使うと、手のひらが触れても線は引かれません。</p>
        ${o.extraHTML || ''}
        <div class="skrow end">${o.onDelete ? '<button class="btn small danger" data-skdel type="button">削除</button><span style="flex:1"></span>' : ''}
          <button class="btn" data-skcancel type="button">${o.cancelLabel || '閉じる'}</button><button class="btn primary" data-skdone type="button">保存</button></div>
      </div>
    </div>`, 'xwide sksheet');
  bindSketch();
}
function skRedraw(){
  const f = state.ui.flow, V = SK_VIEWS[f.sk.view], g = $('#skItems'), fm = $('#skFm');
  if(g) g.innerHTML = f.sk.items.map((it, i) => skItemSVG(it, V, false, i)).join('');
  if(fm) fm.innerHTML = skFmLayer(f.sk.fm, V);
}
// 取り消し用に、操作の前の状態を残す
const skPush = f => { (f.hist ||= []).push(JSON.stringify({ items:f.sk.items, fm:f.sk.fm || null })); if(f.hist.length > 60) f.hist.shift(); };
function skPiecePos(f, hit){
  if(hit.pl){ const [t, i] = hit.pl.split(':'), fm = f.sk.fm[t], s = slotsOf(fm.shape, t)[+i]; return fm.pos?.[+i] || [s.x, s.y]; }
  const it = f.sk.items[+hit.it]; return [it.x, it.y];
}
function skSetPiece(f, hit, x, y){
  if(hit.pl){ const [t, i] = hit.pl.split(':'), fm = f.sk.fm[t];
    fm.pos ||= slotsOf(fm.shape, t).map(s => [s.x, s.y]); fm.pos[+i] = [r1(x), r1(y)]; }
  else { const it = f.sk.items[+hit.it]; it.x = r1(x); it.y = r1(y); }
}
function skDisp(svg, e){
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse()), V = SK_VIEWS[state.ui.flow.sk.view];
  return [Math.max(V.x0, Math.min(V.x0 + V.w, q.x)), Math.max(V.y0, Math.min(V.y0 + V.h, q.y))];
}
function bindSketch(){
  const svg = $('#skSvg'); if(!svg) return;
  const live = $('#skLive');
  svg.addEventListener('pointerdown', e => {
    if(e.pointerType === 'pen') Sketch.penSeen = true;
    else if(Sketch.penSeen && e.pointerType === 'touch') return;     // ペン使用中は手のひらを無視
    e.preventDefault();
    const f = state.ui.flow, V = SK_VIEWS[f.sk.view], P = skDisp(svg, e);
    const hitEl = e.target.closest?.('[data-pl],[data-it]');
    if(f.tool === 'move'){
      if(!hitEl) return;
      const hit = { pl:hitEl.dataset.pl, it:hitEl.dataset.it };
      skPush(f); try{ svg.setPointerCapture(e.pointerId); }catch(err){}
      Sketch.drag = { id:e.pointerId, hit, from:skPiecePos(f, hit) }; return; }
    if(f.tool === 'dotUs' || f.tool === 'dotThem'){
      skPush(f); const [x, y] = V.toP(P[0], P[1]); f.sk.items.push({ k:'d', t:f.tool === 'dotUs' ? 'us' : 'them', x:r1(x), y:r1(y) }); skRedraw(); return; }
    try{ svg.setPointerCapture(e.pointerId); }catch(err){}
    const st = SK_STYLE[f.tool] || SK_STYLE.free;
    live.setAttribute('stroke', st.c); live.setAttribute('stroke-width', st.w);
    if(st.dash) live.setAttribute('stroke-dasharray', st.dash); else live.removeAttribute('stroke-dasharray');
    Sketch.cur = { id:e.pointerId, pts:[P] };
  });
  svg.addEventListener('pointermove', e => {
    const g = Sketch.drag;
    if(g && g.id === e.pointerId){ e.preventDefault(); const f = state.ui.flow, V = SK_VIEWS[f.sk.view], P = skDisp(svg, e), [x, y] = V.toP(P[0], P[1]);
      skSetPiece(f, g.hit, x, y); skRedraw(); return; }
    const c = Sketch.cur; if(!c || c.id !== e.pointerId) return;
    e.preventDefault();
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    (co && co.length ? co : [e]).forEach(ev => {
      const P = skDisp(svg, ev), l = c.pts[c.pts.length - 1];
      if(Math.hypot(P[0] - l[0], P[1] - l[1]) >= .3) c.pts.push(P); });
    live.setAttribute('d', skPath(c.pts));
  });
  const end = e => {
    const g = Sketch.drag;
    if(g && g.id === e.pointerId){ Sketch.drag = null; const f = state.ui.flow; if(f?.kind !== 'sketch') return;
      const to = skPiecePos(f, g.hit), moved = Math.hypot(to[0] - g.from[0], to[1] - g.from[1]);
      if(moved < .5){ f.hist.pop(); return; }
      if(f.trail !== false && moved >= 2){   // 動かした跡を矢印で残す
        const t = g.hit.pl ? (g.hit.pl.startsWith('us') ? 'runUs' : 'runThem') : f.sk.items[+g.hit.it].k === 'b' ? 'ball' : f.sk.items[+g.hit.it].t === 'us' ? 'runUs' : 'runThem';
        f.sk.items.push({ k:'s', t, p:[g.from.map(r1), to.map(r1)] }); }
      skRedraw(); return; }
    const c = Sketch.cur; if(!c || c.id !== e.pointerId) return;
    Sketch.cur = null; live.setAttribute('d', '');
    const f = state.ui.flow; if(f?.kind !== 'sketch') return;
    const len = c.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - c.pts[i-1][0], p[1] - c.pts[i-1][1]) : 0, 0);
    if(c.pts.length < 2 || len < 1) return;
    const V = SK_VIEWS[f.sk.view];
    const simp = c.pts.filter((p, i) => i === 0 || i === c.pts.length - 1 || i % 2 === 0);
    skPush(f); f.sk.items.push({ k:'s', t:f.tool, p:simp.map(p => V.toP(p[0], p[1]).map(r1)) });
    skRedraw();
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}
function skFinish(save){
  const f = state.ui.flow, o = f.o;
  if(save) o.onSave(hasDrawing(f.sk) ? f.sk : null, f.sk);
  if(o.back){ state.ui.flow = o.back; o.backRender(); }
  else if(o.after){ state.ui.flow = null; o.after(); }
  else { closeSheet(); render(); }
}
$('#sheet').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  const d = b.dataset, f = state.ui.flow;
  if(d.sketchev){ sketchEvent(d.sketchev, false); return; }
  if('sketchgoal' in d){ sketchGoal(); return; }
  if(d.board){ openBoard(d.board); return; }
  if(f?.kind !== 'sketch') return;
  if(d.sktool){ f.tool = state.ui.skTool = d.sktool; document.querySelectorAll('[data-sktool]').forEach(x => x.setAttribute('aria-pressed', x.dataset.sktool === d.sktool)); return; }
  if('skundo' in d){ const h = f.hist?.pop(); if(h){ const o = JSON.parse(h); f.sk.items = o.items; if(o.fm) f.sk.fm = o.fm; skRedraw(); } else toast('これ以上は戻せません'); return; }
  if('skclear' in d){ skPush(f); f.sk.items = f.sk.items.filter(x => x.k === 'b'); skRedraw(); return; }
  if('skreset' in d){ skPush(f); if(f.sk.fm){ delete f.sk.fm.us.pos; delete f.sk.fm.them.pos; } f.sk.items = f.sk.items.filter(x => x.k !== 's'); skRedraw(); toast('選手を最初の並びに戻しました'); return; }
  if('sktrail' in d){ f.trail = f.trail === false; b.setAttribute('aria-pressed', f.trail !== false); return; }
  if('skdone' in d){ skFinish(true); return; }
  if('skcancel' in d){ skFinish(false); return; }
  if('skdel' in d){ f.o.onDelete(); skFinish(false); return; }
});

/* ---------- CK・FK の作図 ---------- */
function spKick(e){
  if(e.type === 'ck'){ const L = e.side === 'L'; return e.team === 'us' ? { x:105, y:L ? 0 : 68 } : { x:0, y:L ? 68 : 0 }; }
  return e.x != null ? { x:e.x, y:e.y } : null;
}
function maybeSetPieceSketch(e){
  if(!state.meta.settings.drawSP || LV() !== 'full') return;
  if(e.type === 'fk' && !(e.team === 'us' ? e.x >= 70 : e.x <= 35)) return;   // 攻撃側のアタッキングサードのFKだけ
  setTimeout(() => { if(state.ui.screen === 'record' && !state.ui.flow) sketchEvent(e.id, true); }, 250);
}
function sketchEvent(id, live){
  const e = state.events.find(x => x.id === id); if(!e) return;
  const m = match(e.matchId), k = spKick(e);
  const sk = e.sketch ? structuredClone(e.sketch) : { view:e.team === 'us' ? 'halfUs' : 'halfThem', items:k ? [{ k:'b', x:k.x, y:k.y }] : [] };
  const back = live ? null : (state.ui.flow?.kind === 'edit' ? state.ui.flow : null);
  openSketch({ title:`✏️ ${e.type === 'ck' ? 'CK' : 'FK'}の作図`, sub:`${esc(teamName(m, e.team))}　${esc(pShort(m, e.period))} ${e.clock}${e.ckType ? '　' + esc(lbl(CK_TYPES, e.ckType)) : ''}`,
    sketch:sk, cancelLabel:live ? 'あとで' : '閉じる', tool:'ball',
    onSave:s => { e.sketch = s; e.synced = false; save.events(); toast(s ? '作図を保存しました' : '作図を消しました'); },
    back, backRender:() => renderSheet() });
}

/* ---------- 得点までの流れ ---------- */
function sketchGoal(){
  const gf = state.ui.flow; if(gf?.kind !== 'goal') return;
  const e = state.events.find(x => x.id === gf.eventId); if(!e) return;
  const m = match(e.matchId);
  const sk = e.buildup ? structuredClone(e.buildup) : { view:'full', items:e.x != null ? [{ k:'b', x:e.x, y:e.y }] : [] };
  openSketch({ title:'✏️ 得点までの流れ', sub:`${e.team === 'us' ? '得点' : '失点'}　${esc(pShort(m, e.period))} ${e.clock}　白い丸＝シュート位置`, sketch:sk, tool:'ball',
    dirLabel:e.team === 'us' ? `${m.ourName}の攻撃 ▶` : `◀ ${m.opponent}の攻撃`,
    extraHTML:'<p class="skhint">「ボール」で、奪った場所からシュートまでのパスやドリブルを順に描くと、<b>ボールを得た場所</b>と<b>崩したレーン</b>を自動で入れます。</p>',
    onSave:s => { e.buildup = s; e.synced = false; save.events();
      const got = s ? deriveBuildup(e, s, gf.draft) : [];
      toast(got.length ? `図から「${got.join('」「')}」を入れました（違っていたら直せます）` : '流れの図を保存しました'); },
    back:gf, backRender:() => renderSheet() });
}
function deriveBuildup(e, sk, draft){
  const balls = sk.items.filter(i => i.k === 's' && i.t === 'ball'); if(!balls.length) return [];
  const got = [], first = balls[0].p[0], last = balls.at(-1).p[0];
  if(draft.phase !== 'setpiece' && e.goal?.originZone == null){ const z = zoneOf(first[0], first[1]); draft.originZone = `${z.third}-${z.lane}`; got.push(e.team === 'us' ? 'ボールを得た場所' : 'ボールを失った場所'); }
  if(e.goal?.lane == null){ const l = zoneOf(last[0], last[1]).lane; draft.lane = e.team === 'us' ? l : 6 - l; got.push('崩したレーン'); }
  return got;
}

/* ---------- 作戦ボード（ハーフタイムなど） ---------- */
function fmSnapshot(){
  const f = fmCur();
  return { us:{ shape:f.us.shape, nums:(f.us.slots || []).map(id => player(id)?.num ?? null) }, them:{ shape:f.them.shape, nums:(f.them.slots || []).slice() } };
}
function boardsHTML(m){
  const bs = m.boards || [];
  return `<div class="q">✏️ 作戦ボード <span class="muted" style="font-weight:700">Apple Pencilで動きや修正点を描いて保存（試合後のレポートにも載ります）</span></div>
    <div class="bthumbs">${bs.map(b => `<button type="button" class="bthumb" data-board="${b.id}">${sketchSVG(b.sketch)}<span>${esc(b.label)}</span></button>`).join('')}
      <button type="button" class="bthumb new" data-board="new"><b>＋</b><span>新しいボード</span></button></div>`;
}
function openBoard(id){
  const m = cur(); if(!m) return;
  if($('#hp0')) saveHtPointsQuiet(m);
  const b = id === 'new' ? null : (m.boards || []).find(x => x.id === id);
  const sk = b ? structuredClone(b.sketch) : { view:'full', items:[{ k:'b', x:52.5, y:34 }], fm:fmSnapshot() };
  sk.fm ||= { us:{ shape:null, nums:[] }, them:{ shape:null, nums:[] } };
  const fmOpts = sel => `<option value="">なし</option>${FM_GROUPS.map(([g, l]) => `<optgroup label="${g}">${l.map(k => `<option ${sel === k ? 'selected' : ''}>${k}</option>`).join('')}</optgroup>`).join('')}`;
  const per = m.periods[state.timer.p];
  openSketch({ title:'✏️ 作戦ボード', sub:b ? esc(b.label) : `${esc(per?.label || '')}時点の配置`, sketch:sk, tool:'move', dirLabel:`${m.ourName}の攻撃 ▶`,
    extraHTML:`<div class="skfm"><label>${esc(m.ourName)}<select data-skfm="us">${fmOpts(sk.fm.us.shape)}</select></label>
        <label>${esc(m.opponent)}<select data-skfm="them">${fmOpts(sk.fm.them.shape)}</select></label></div>
      <div class="skrow"><button class="btn small" data-sktrail type="button" aria-pressed="true">↗ 動かした跡を残す</button><button class="btn small" data-skreset type="button">↺ 最初の並び</button></div>`,
    onSave:(s, raw) => { const s2 = raw;
      m.boards ||= [];
      if(b) b.sketch = s2;
      else m.boards.push({ id:'b' + uid(), period:state.timer.p, label:`${per?.label || ''} ボード${m.boards.length + 1}`, createdAt:new Date().toISOString(), sketch:s2 });
      m.dirty = true; save.matches(); toast('作戦ボードを保存しました'); },
    onDelete:b ? () => { m.boards = m.boards.filter(x => x.id !== b.id); m.dirty = true; save.matches(); toast('ボードを削除しました'); } : null,
    after:() => halftimeSheet() });
}
function saveHtPointsQuiet(m){
  const old = m.points?.ht || [], vals = [0,1,2].map(i => $('#hp' + i)?.value.trim() || '').filter(Boolean);
  if(!vals.length && !old.length) return;
  m.points = { ...(m.points || {}), ht:vals.map((text, i) => ({ text, eval:old[i]?.eval || null, period:old[i]?.period ?? state.timer.p })) };
  save.matches();
}

/* ---------- PK のコース（キッカーから見た向き） ---------- */
const PK_IN = ['TL','TC','TR','ML','MC','MR','BL','BC','BR'];
const PK_LABEL = { TL:'左上', TC:'中上', TR:'右上', ML:'左中', MC:'真ん中', MR:'右中', BL:'左下', BC:'中下', BR:'右下', OL:'左に外れ', OT:'上に外れ', OR:'右に外れ' };
function pkGridHTML(sel, attr){
  const b = (k, cls) => `<button type="button" class="${cls}" data-${attr}="${k}" aria-pressed="${sel === k}" aria-label="${PK_LABEL[k]}">${cls.startsWith('out') ? PK_LABEL[k] : ''}</button>`;
  return `<div class="pkgoal">${b('OT', 'out top')}${b('OL', 'out left')}<div class="pkframe">${PK_IN.map(k => b(k, 'in')).join('')}</div>${b('OR', 'out right')}</div>`;
}
// PKのコース：マスの中に「何人目か」の丸（緑＝成功・赤＝失敗）。試合中のPKは「P」
const pkTag = x => `<i class="pkn ${x.ok ? 'ok' : 'ng'}" title="${esc(x.label)}">${x.no ?? 'P'}</i>`;
function pkMapHTML(list){
  const cell = (k, cls) => `<div class="${cls}">${list.filter(x => x.course === k).map(pkTag).join('')}</div>`;
  return `<div class="pkgoal map">${cell('OT', 'out top')}${cell('OL', 'out left')}<div class="pkframe">${PK_IN.map(k => cell(k, 'in')).join('')}</div>${cell('OR', 'out right')}</div>`;
}
function pkList(evs){
  const who = e => e.team === 'us' ? (e.num ? `#${e.num} ${family(e.name)}` : '') : (e.oppNum ?? e.goal?.oppNum) != null ? `#${e.oppNum ?? e.goal.oppNum}` : '';
  return evs.flatMap(e => {
    if(e.type === 'shot' && e.pk && e.pkCourse){ const m = match(e.matchId);
      return [{ team:e.team, course:e.pkCourse, ok:e.result === 'goal', no:null, who:who(e), when:`${pShort(m, e.period)} ${e.clock}`, label:`試合中のPK ${pShort(m, e.period)} ${e.clock} ${who(e)}` }]; }
    if(e.type === 'pkso' && e.course) return [{ team:e.team, course:e.course, ok:!!e.scored, no:e.no, who:who(e), label:`${e.no}人目 ${who(e)}` }];
    return []; });
}
function pkOrderHTML(list){
  if(!list.length) return '';
  return `<ol class="pkorder">${list.map(x => `<li>${pkTag(x)}<span>${x.no ? `${x.no}人目` : `PK ${esc(x.when)}`}</span><b>${esc(x.who || '')}</b><span class="muted">${esc(PK_LABEL[x.course] || '')}</span><span class="${x.ok ? 'okt' : 'ngt'}">${x.ok ? '成功' : '失敗'}</span></li>`).join('')}</ol>`;
}
function pkPanelHTML(evs, usName, themName){
  const l = pkList(evs); if(!l.length) return '';
  const side = (t, n) => { const xs = l.filter(x => x.team === t); return `<div><h4>${esc(n)}のキッカー（${xs.length}本）</h4>${pkMapHTML(xs)}${pkOrderHTML(xs)}</div>`; };
  return `<div class="pkmaps">${side('us', usName)}${side('them', themName)}</div>
    <div class="sm muted">キッカーから見た向き。丸の数字＝PK戦の何人目か（Pは試合中のPK）。緑＝成功・赤＝失敗</div>`;
}

/* ---------- 時間帯別（15分ごと） ---------- */
function timeBuckets(ms){
  const map = new Map(), order = [];
  const key = (lb, b) => { if(!order.includes(lb)) order.push(lb); return `${lb}|${b}`; };
  ms.forEach(m => { const ev = evOf(m.id);
    m.periods.forEach((p, i) => { if(p.kind === 'pk') return;
      const n = Math.max(1, Math.ceil(p.min / 15));
      for(let b = 0; b < n; b++){ const k = key(p.label, b); if(!map.has(k)) map.set(k, { label:p.label, b, from:b * 15, to:Math.min(p.min, (b + 1) * 15), us:{ sh:0, g:0 }, them:{ sh:0, g:0 } }); }
      ev.filter(e => e.period === i && (e.type === 'shot' || e.type === 'og')).forEach(e => {
        const at = e.sec >= p.min * 60, b = at ? 99 : Math.min(n - 1, Math.floor(e.sec / 900)), k = key(p.label, b);
        if(!map.has(k)) map.set(k, { label:p.label, b, at:true, from:p.min, us:{ sh:0, g:0 }, them:{ sh:0, g:0 } });
        const r = map.get(k)[e.team]; if(e.type === 'shot') r.sh++; if(isGoalEv(e)) r.g++; }); }); });
  return [...map.values()].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label) || a.b - b.b);
}
function bucketsSVG(bks, usName, themName){
  if(!bks.length) return '';
  const cw = 64, W = Math.max(300, bks.length * cw + 20), mid = 66, H = 150, s = 44 / Math.max(1, ...bks.map(b => Math.max(b.us.sh, b.them.sh)));
  const cols = bks.map((b, i) => { const x = 20 + i * cw + cw / 2, hu = b.us.sh * s, ht = b.them.sh * s;
    const lb = b.at ? `${b.label} AT` : `${b.label}`, rg = b.at ? `${b.from}+` : `${b.from}-${b.to}'`;
    return `<g><title>${esc(lb)} ${rg}：${esc(usName)} シュート${b.us.sh}・得点${b.us.g}／${esc(themName)} シュート${b.them.sh}・得点${b.them.g}</title>
      <rect x="${x - cw / 2 + 2}" y="8" width="${cw - 4}" height="${H - 40}" fill="transparent"/>
      ${hu ? `<rect x="${x - 9}" y="${mid - hu}" width="18" height="${hu}" rx="3" fill="var(--kit-hi)"/>` : ''}
      ${ht ? `<rect x="${x - 9}" y="${mid + 2}" width="18" height="${ht}" rx="3" fill="var(--opp)"/>` : ''}
      <text x="${x}" y="${mid - hu - 4}" text-anchor="middle" font-size="11" fill="var(--ink-2)">${b.us.sh || ''}${b.us.g ? ` ⚽${b.us.g}` : ''}</text>
      <text x="${x}" y="${mid + ht + 14}" text-anchor="middle" font-size="11" fill="var(--ink-2)">${b.them.sh || ''}${b.them.g ? ` ⚽${b.them.g}` : ''}</text>
      <text x="${x}" y="${H - 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--ink)">${esc(lb)}</text>
      <text x="${x}" y="${H - 5}" text-anchor="middle" font-size="10" fill="var(--ink-3)">${rg}</text></g>`; }).join('');
  return `<svg class="tbsvg" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W * 1.5)}px" role="img" aria-label="15分ごとのシュートと得点">
    <line x1="10" x2="${W - 10}" y1="${mid + 1}" y2="${mid + 1}" stroke="var(--line)" stroke-width="1"/>${cols}</svg>
    <div class="tblegend"><span><i style="background:var(--kit-hi)"></i>${esc(usName)}のシュート（上）</span><span><i style="background:var(--opp)"></i>${esc(themName)}のシュート（下）</span><span>⚽＝得点</span></div>`;
}

/* ---------- 動画の目次（YouTube のチャプター形式） ---------- */
const vfmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  return h ? `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`; };
function chaptersText(m){
  const ev = evOf(m.id), kos = ev.filter(e => e.type === 'kickoff' && e.wall);
  const base = m.videoStart || kos[0]?.wall; if(!base) return null;
  const items = []; let a = 0, b = 0;
  ev.slice().sort((x, y) => (x.wall || 0) - (y.wall || 0)).forEach(e => { if(!e.wall) return;
    if(e.type === 'kickoff') items.push({ w:e.wall, t:`${pLabel(m, e.period)} キックオフ` });
    else if(isGoalEv(e) && m.periods[e.period]?.kind !== 'pk'){ e.team === 'us' ? a++ : b++;
      const who = e.type === 'og' ? 'OG' : e.team === 'us' ? (e.num ? `#${e.num} ${family(e.name)}` : '') : (e.oppNum ?? e.goal?.oppNum) != null ? `相手#${e.oppNum ?? e.goal.oppNum}` : '';
      items.push({ w:e.wall, t:`⚽ ${e.team === 'us' ? '得点' : '失点'} ${a}-${b}${who ? ' ' + who : ''}` }); }
    else if(e.type === 'mark'){ const p = player(e.playerId);
      items.push({ w:e.wall, t:`★ ${e.tag ? lbl(MARK_TAGS, e.tag).replace(/^\S+\s/, '') : '見直し'}${p ? ` #${p.num} ${family(p.name)}` : ''}${e.note ? ` ${e.note}` : ''}` }); }
    else if(e.type === 'ck' && e.sketch) items.push({ w:e.wall, t:`${e.team === 'us' ? '' : '相手'}CK` }); });
  const out = [];
  items.filter(x => x.w >= base - 5000).forEach(x => { const rel = Math.max(0, x.w - base), last = out.at(-1);
    if(last && rel - last.rel < 10000) last.t += ` / ${x.t}`; else out.push({ rel, t:x.t }); });
  if(!out.length || out[0].rel >= 10000) out.unshift({ rel:0, t:'試合前' }); else out[0].rel = 0;
  return out.map(x => `${vfmt(x.rel)} ${x.t}`).join('\n');
}
function showChapters(m){
  const t = chaptersText(m);
  if(!t){ toast('キックオフの記録がないため、目次を作れません'); return; }
  const base = `動画目次_${m.date}_vs${m.opponent}`.replace(/[\\/:*?"<>|\s]/g, '');
  openModal({ title:'🎬 動画の目次（YouTubeのチャプター）', size:'wide',
    body:`<p style="font-size:13px;margin:0">YouTubeの動画の「説明」に貼り付けると、目次（チャプター）になります。${m.videoStart ? '🎥 撮影開始を押した時刻を 0:00 にしています。' : '🎥 撮影開始が記録されていないので、最初のキックオフを 0:00 にしています。ずれる場合は数字を直してください。'}</p>
      <textarea id="chapText" style="width:100%;min-height:240px;border-radius:10px;padding:10px;background:var(--surface-2);color:var(--ink);border:1px solid var(--line);font-size:14px">${esc(t)}</textarea>
      <p class="muted" style="font-size:12px;margin:0">YouTubeの決まり：最初が 0:00、3つ以上、10秒以上の間隔（近い記録は1行にまとめてあります）。</p>`,
    actions:[{ label:'閉じる' }, { label:'⬇︎ テキストで保存', onClick:() => downloadBlob(new Blob([$('#chapText')?.value || t], { type:'text/plain' }), base + '.txt') },
      { label:'📋 コピー', kind:'primary', onClick:() => { const v = t; navigator.clipboard?.writeText ? navigator.clipboard.writeText(v).then(() => toast('コピーしました'), () => showCopy(v)) : showCopy(v); } }] });
}

/* ---------- レポート用のまとめ（作図・時間帯・PK） ---------- */
function reportDrawHTML(m){
  const ev = evOf(m.id), bs = (m.boards || []).filter(b => hasDrawing(b.sketch) || b.sketch?.fm);
  const gl = ev.filter(e => isGoalEv(e) && hasDrawing(e.buildup)), sp = ev.filter(e => (e.type === 'ck' || e.type === 'fk') && hasDrawing(e.sketch));
  const tb = timeBuckets([m]), pk = pkPanelHTML(ev, m.ourName, m.opponent);
  if(!bs.length && !gl.length && !sp.length && !pk && !ev.some(e => e.type === 'shot')) return '';
  const fig = (svg, cap) => `<figure class="rp-fig">${svg}<figcaption>${cap}</figcaption></figure>`;
  return `<div class="rp-more">
    <div class="rp-col"><h4>時間帯別（15分ごと）</h4>${bucketsSVG(tb, m.ourName, m.opponent)}${pk ? `<h4>PKのコース</h4>${pk}` : ''}</div>
    ${gl.length ? `<div class="rp-col"><h4>得点までの流れ</h4><div class="rp-figs">${gl.map(e => fig(sketchSVG(e.buildup), `${esc(pShort(m, e.period))} ${e.clock} ${e.team === 'us' ? '得点' : '失点'}${e.num ? ` #${e.num}` : ''}`)).join('')}</div></div>` : ''}
    ${bs.length ? `<div class="rp-col"><h4>作戦ボード</h4><div class="rp-figs">${bs.map(b => fig(sketchSVG(b.sketch), esc(b.label))).join('')}</div></div>` : ''}
    ${sp.length ? `<div class="rp-col"><h4>セットプレーの作図</h4><div class="rp-figs half">${sp.slice(0, 8).map(e => fig(sketchSVG(e.sketch), `${esc(pShort(m, e.period))} ${e.clock} ${e.team === 'us' ? '' : '相手'}${e.type === 'ck' ? 'CK' : 'FK'}`)).join('')}</div></div>` : ''}
  </div>`;
}

/* ---------- データ画面のパネル ---------- */
function drawPanelsHTML(ms, ev, usName, themName){
  const tb = timeBuckets(ms), pk = pkPanelHTML(ev, usName, themName);
  const sps = ev.filter(e => (e.type === 'ck' || e.type === 'fk') && hasDrawing(e.sketch));
  const ov = team => { const list = sps.filter(e => e.team === team && e.type === 'ck'); if(!list.length) return '';
    const sk = { view:team === 'us' ? 'halfUs' : 'halfThem', items:list.flatMap(e => e.sketch.items.filter(i => i.k === 's' && i.t === 'ball')) };
    return `<div><h4>${esc(team === 'us' ? usName : themName)}のCK ${list.length}本（ボールの軌道を重ねて表示）</h4>${sketchSVG(sk, { faint:true })}</div>`; };
  const single = ms.length === 1 ? ms[0] : null;
  return `<section class="card panel">
      <div class="hd"><h3>⏱ 時間帯別（15分ごと）</h3><span class="muted" style="font-size:12px">立ち上がり・終盤に強いか弱いかが分かります。棒に触れると数が出ます</span>
        ${single ? '<button class="btn small" data-chapters type="button">🎬 動画の目次を作る</button>' : ''}</div>
      ${bucketsSVG(tb, usName, themName)}
    </section>
    ${sps.length || pk ? `<div class="dgrid" style="grid-template-columns:${sps.length && pk ? '1.6fr 1fr' : '1fr'}">
      ${sps.length ? `<section class="card panel"><div class="hd"><h3>✏️ セットプレーの作図</h3><span class="muted" style="font-size:12px">図に触れると開いて直せます</span></div>
        <div class="spov">${ov('us')}${ov('them')}</div>
        <div class="spthumbs">${sps.map(e => { const m = match(e.matchId); return `<button type="button" class="bthumb" data-sketchev="${e.id}">${sketchSVG(e.sketch)}<span>${esc(pShort(m, e.period))} ${e.clock} ${e.team === 'us' ? '' : '相手'}${e.type === 'ck' ? 'CK' : 'FK'}${ms.length > 1 ? ` vs ${esc(m.opponent)}` : ''}</span></button>`; }).join('')}</div></section>` : ''}
      ${pk ? `<section class="card panel"><div class="hd"><h3>🥅 PKのコース</h3></div>${pk}</section>` : ''}
    </div>` : ''}`;
}

/* ---------- 画面側のクリック（シートの外） ---------- */
document.addEventListener('click', e => {
  if(e.target.closest('#sheet') || e.target.closest('#pop')) return;
  const b = e.target.closest('button'); if(!b) return;
  const d = b.dataset;
  if(d.sketchev){ sketchEvent(d.sketchev, false); return; }
  if('chapters' in d){ const m = dataMatches()[0]; if(m) showChapters(m); return; }
  if(d.pkcs){ state.ui.pkCourse = state.ui.pkCourse === d.pkcs ? null : d.pkcs; render(); return; }
});
$('#sheet').addEventListener('change', e => {
  if(e.target.id === 'setDrawSP'){ state.meta.settings.drawSP = e.target.checked; save.meta(); }
  const t = e.target.dataset?.skfm, f = state.ui.flow;
  if(t && f?.kind === 'sketch'){ skPush(f); const old = f.sk.fm[t] || {};
    f.sk.fm[t] = { shape:e.target.value || null, nums:e.target.value === old.shape ? old.nums : (t === 'us' && e.target.value ? slotsOf(e.target.value, 'us').map((_, i) => old.nums?.[i] ?? null) : []) };
    skRedraw(); }
});
