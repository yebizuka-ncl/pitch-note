"use strict";
/* =========================================================
   9. 集計
   ========================================================= */
function teamStats(evs, team){
  const s = evs.filter(e => e.team === team), shots = s.filter(e => e.type === 'shot');
  const cnt = r => shots.filter(e => e.result === r).length;
  const open = shots.filter(e => !e.pk), cks = s.filter(e => e.type === 'ck');
  return {
    goals:cnt('goal') + s.filter(e => e.type === 'og').length, shots:shots.length, onT:cnt('goal') + cnt('on'), off:cnt('off'), block:cnt('block'),
    inPA:shots.filter(e => e.area !== 'OUT').length,
    avgDist:open.length ? Math.round(open.reduce((a,e) => a + e.dist, 0) / open.length) : null,
    ck:cks.length, ckShot:cks.filter(c => shots.some(x => x.matchId === c.matchId && x.period === c.period && x.sec >= c.sec && x.sec - c.sec <= 15)).length,
    fk:s.filter(e => e.type === 'fk').length, pk:shots.filter(e => e.pk).length,
  };
}
const rate = (a, b) => b ? `<small>（${Math.round(a/b*100)}%）</small>` : '';
function compareTable(evs, usName, themName){
  const u = teamStats(evs, 'us'), t = teamStats(evs, 'them');
  const rows = [
    ['得点', u.goals, t.goals, '', '', true], ['シュート', u.shots, t.shots],
    ['枠内', u.onT, t.onT, rate(u.onT, u.shots), rate(t.onT, t.shots)],
    ['PA内から', u.inPA, t.inPA, rate(u.inPA, u.shots), rate(t.inPA, t.shots)],
    ['枠外', u.off, t.off], ['ブロックされた', u.block, t.block],
    ['平均距離', u.avgDist != null ? `${u.avgDist}<small>m</small>` : '—', t.avgDist != null ? `${t.avgDist}<small>m</small>` : '—', '', '', false, true],
    ['CK', u.ck, t.ck], ['CK→シュート<br><small class="muted">15秒以内</small>', u.ckShot, t.ckShot, rate(u.ckShot, u.ck), rate(t.ckShot, t.ck)],
    ['FK', u.fk, t.fk], ['PK', u.pk, t.pk],
  ];
  return `<div class="cmp"><div class="cmp-head"><span>${esc(usName)}</span><span></span><span>${esc(themName)}</span></div>
    ${rows.map(([l, a, b, sa='', sb='', key=false, nobar=false]) => { const mx = Math.max(1, +a || 0, +b || 0);
      return `<div class="cmp-row ${key?'key':''}">
        <div class="cv us">${nobar ? '' : `<span class="bar" style="width:${(+a||0)/mx*100}%"></span>`}<b>${sa}${a}</b></div>
        <div class="cl">${l}</div>
        <div class="cv them">${nobar ? '' : `<span class="bar" style="width:${(+b||0)/mx*100}%"></span>`}<b>${b}${sb}</b></div></div>`; }).join('')}
  </div>`;
}
function countRows(items, us, them, get){
  const rows = items.map(it => ({ label:it.label, u:us.filter(g => get(g) === it.id).length, t:them.filter(g => get(g) === it.id).length })).filter(r => r.u || r.t);
  if(!rows.length) return '<div class="muted" style="font-size:12.5px">まだありません</div>';
  const mx = Math.max(1, ...rows.map(r => Math.max(r.u, r.t)));
  return `<div class="ct">${rows.map(r => `<div class="ct-row"><span class="ct-l">${r.label}</span>
    <span class="ct-b"><i class="u" style="width:${r.u/mx*100}%"></i><i class="t" style="width:${r.t/mx*100}%"></i></span>
    <span class="ct-n num">${r.u}<em>-</em>${r.t}</span></div>`).join('')}</div>`;
}
function goalDesc(g){
  const x = g.goal; if(!x) return '';
  const parts = [lbl(PHASES, x.phase) + (x.detail ? `（${lbl(ALL_DETAILS, x.detail)}）` : '')];
  if(x.originZone) parts.push(`${g.team==='us'?'得た':'失った'}場所：${zoneShort(x.originZone)}`);
  if(x.lastPass) parts.push(lbl(LASTPASS, x.lastPass) + (x.lane ? `（${LANES.find(l => l.id === x.lane).short}）` : ''));
  const fin = [lbl(FEET, x.foot), lbl(TOUCH, x.touch)].filter(Boolean).join('・'); if(fin) parts.push(fin);
  if(x.assistId){ const p = player(x.assistId); if(p) parts.push(`アシスト #${p.num} ${family(p.name)}`); }
  if(x.oppNum) parts.push(`相手の得点者 #${x.oppNum}`);
  return parts.join(' ／ ');
}
// 出場時間：各ピリオドのキックオフ時のメンバー＋交代から計算（給水で時計を止めた時間は含まない）
function playSeconds(m, periodIdxs){
  const res = {}, evs = evOf(m.id);
  periodIdxs.forEach(i => {
    const ko = evs.find(e => e.type === 'kickoff' && e.period === i); if(!ko || !ko.lineup) return;
    const end = Math.floor(((state.current === m.id && state.timer.p === i) ? liveMs() : (m.periods[i].played || 0)) / 1000);
    const on = {}; ko.lineup.forEach(id => on[id] = 0);
    evs.filter(e => e.period === i && e.team !== 'them' && (e.type === 'sub' || (e.type === 'card' && e.sentOff))).sort((a,b) => a.sec - b.sec).forEach(s => {
      const out = s.type === 'sub' ? s.outId : s.playerId;
      if(out in on){ res[out] = (res[out] || 0) + Math.max(0, s.sec - on[out]); delete on[out]; }
      if(s.type === 'sub') on[s.inId] = s.sec;
    });
    Object.entries(on).forEach(([id, st]) => res[id] = (res[id] || 0) + Math.max(0, end - st));
  });
  return res;
}

