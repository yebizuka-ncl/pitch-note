"use strict";
/* =========================================================
   2. データ層
   - 保存先は IndexedDB（容量が大きく、Safari の 7 日削除の対象外になる PWA と組み合わせて使う）
   - 画面の処理は同期的に書けるよう、起動時に全データをメモリへ読み込み、書き込みは裏で IndexedDB へまとめて保存する
   - IndexedDB が使えない環境（プライベートブラウズ等）では localStorage に切り替える
   match.periods = [{ label, short, min, kind:'reg'|'et'|'pk', kickoff, attack, started, played }]
   ========================================================= */
// チームごとに分けて保存するもの（名簿・出場メンバー・記録中の試合・時計・陣形）と、全体で1つのもの（試合・記録・設定）
const GK = { teams:'pn.teams.v1', matches:'pn.matches.v5', events:'pn.events.v5', meta:'pn.meta.v5' };
const TK = name => `pn.${name}.v6.${state.teamId}`;

const Store = {
  ok:true, mode:'idb', db:null, cache:new Map(), dirty:new Set(), timer:null,
  async boot(){
    try{
      this.db = await new Promise((res, rej) => {
        const rq = indexedDB.open('pitch-note', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      });
      const all = await new Promise((res, rej) => {
        const out = new Map(), tx = this.db.transaction('kv', 'readonly'), st = tx.objectStore('kv'), cur = st.openCursor();
        cur.onsuccess = () => { const c = cur.result; if(c){ out.set(c.key, c.value); c.continue(); } else res(out); };
        cur.onerror = () => rej(cur.error);
      });
      this.cache = all;
      // 初回：localStorage に残っている以前のデータを IndexedDB へ移す
      if(!this.cache.size){
        try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i);
          if(k && k.startsWith('pn.')){ try{ this.cache.set(k, JSON.parse(localStorage.getItem(k))); this.dirty.add(k); }catch(e){} } } }catch(e){}
        this.flush();
      }
      try{ navigator.storage?.persist?.(); }catch(e){}   // 端末の容量が少なくなっても消されにくくする
    }catch(e){
      this.mode = 'ls';
      try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith('pn.')) this.cache.set(k, JSON.parse(localStorage.getItem(k))); } }
      catch(e2){ this.ok = false; }
    }
  },
  read(k, fb){ return this.cache.has(k) ? structuredClone(this.cache.get(k)) : fb; },
  write(k, v){ this.cache.set(k, v); this.dirty.add(k); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 300); return true; },
  remove(k){ this.cache.delete(k); this.dirty.add(k); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 300); },
  flush(){
    const keys = [...this.dirty]; this.dirty.clear(); if(!keys.length) return;
    if(this.mode === 'idb' && this.db){
      try{
        const tx = this.db.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
        keys.forEach(k => this.cache.has(k) ? st.put(JSON.parse(JSON.stringify(this.cache.get(k))), k) : st.delete(k));
        tx.onerror = () => { this.ok = false; showStorageWarn(); };
      }catch(e){ this.ok = false; showStorageWarn(); }
    } else {
      try{ keys.forEach(k => this.cache.has(k) ? localStorage.setItem(k, JSON.stringify(this.cache.get(k))) : localStorage.removeItem(k)); }
      catch(e){ this.ok = false; showStorageWarn(); }
    }
  },
  dump(){ const o = {}; this.cache.forEach((v, k) => o[k] = v); return o; },
};
// 画面を閉じる・アプリを切り替える直前に、書きかけのデータを確実に保存する
addEventListener('pagehide', () => Store.flush());
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') Store.flush(); });

const state = {
  teams:null, teamId:null,
  roster:[], lineup:[], current:null, timer:{ p:0, el:{}, startedAt:null, brk:null }, fm:null,
  matches:[], events:[], meta:null,
  ui: { screen:'teams', team:'us', pos:null, flow:null, resetArmed:false, subOut:'', subIn:'', modal:null,
        fmSel:null, fmTeam:'us', fmPeriod:null, setupKit:null, dataDate:null, dataMatch:null, dataPeriod:'all',
        rosterEdit:false, pkKicker:null, pop:null, swapFrom:null, pick:null },
};
const save = {
  roster:()=>Store.write(TK('roster'),state.roster), lineup:()=>Store.write(TK('lineup'),state.lineup),
  current:()=>Store.write(TK('current'),state.current), timer:()=>Store.write(TK('timer'),state.timer),
  fm:()=>Store.write(TK('fm'),state.fm),
  matches:()=>Store.write(GK.matches,state.matches), events:()=>Store.write(GK.events,state.events),
  meta:()=>Store.write(GK.meta,state.meta), teams:()=>Store.write(GK.teams,state.teams),
};
const DEFAULT_KITS = { 1:{ a:'#8c1d2f', b:'#ff7a1a' }, 2:{ a:'#1d4fb0', b:'#c9d1dc' } };
const DEFAULT_SETTINGS = { sound:true, lefty:false, drawSP:true, level:'normal' };
function initState(){
  state.teams = Store.read(GK.teams, null);
  state.matches = Store.read(GK.matches, []);
  state.events = Store.read(GK.events, []);
  state.meta = Store.read(GK.meta, { lastSync:null, ourName:'自チーム', kit:1, bright:false });
  state.meta.settings = { ...DEFAULT_SETTINGS, ...(state.meta.settings || {}) };
  delete state.meta.deletedSrc;   // 以前の「予定を読み込まない」一覧は使わない（シートにある予定は必ず読み込む）
  // 初回：これまでのデータを「サッカー部」チームに引き継ぐ
  if(!state.teams){
    const t = { id:'t' + Date.now().toString(36), name:'サッカー部', short:state.meta.ourName || '自チーム', category:'中学 部活', kits:JSON.parse(JSON.stringify(DEFAULT_KITS)), lastKit:state.meta.kit || 1 };
    state.teams = [t]; state.teamId = t.id;
    const mv = (oldKey, name) => { const v = Store.read(oldKey, null); if(v != null) Store.write(`pn.${name}.v6.${t.id}`, v); };
    mv('pn.roster.v1', 'roster'); mv('pn.lineup.v1', 'lineup'); mv('pn.current.v5', 'current'); mv('pn.timer.v5', 'timer'); mv('pn.formation.v5', 'fm');
    if(!Store.read(`pn.roster.v6.${t.id}`, null)) Store.write(`pn.roster.v6.${t.id}`, DEFAULT_ROSTER.map(p => ({ ...p })));
    state.matches.forEach(m => { m.teamId ||= t.id; m.kitColors ||= DEFAULT_KITS[m.kit || 1]; });
    save.teams(); save.matches(); state.meta.teamId = t.id; save.meta();
  }
}
function loadTeam(id){
  state.teamId = id;
  state.roster = Store.read(TK('roster'), []);
  state.lineup = Store.read(TK('lineup'), []);
  state.current = Store.read(TK('current'), null);
  state.timer = Store.read(TK('timer'), { p:0, el:{}, startedAt:null, brk:null });
  state.fm = Store.read(TK('fm'), null);
  state.meta.teamId = id; save.meta();
  state.ui.dataDate = null; state.ui.dataMatch = null; state.ui.pos = null; state.ui.setupKit = null;
}
const team = () => state.teams.find(t => t.id === state.teamId) || state.teams[0];
const teamMatches = () => state.matches.filter(m => m.teamId === state.teamId && !m.deleted);   // 削除した試合（同期待ち）は出さない
const teamKits = () => ({ 1:{ label:'1st', ...team().kits[1] }, 2:{ label:'2nd', ...team().kits[2] } });
const kitOf = m => m?.kitColors || team().kits[m?.kit || 1];

/* ---------- 同期（将来：GASのWebアプリURLへPOST） ----------
   削除した記録も deleted:true の印を付けて送る。GAS 側は記録の id で上書き保存する（二重登録にならない） */
const unsynced = () => state.events.filter(e => !e.synced);
function runSync(){
  const evs = unsynced(); const ids = new Set(evs.map(e => e.matchId));
  const payload = { app:'pitch-note', schema:6, exportedAt:new Date().toISOString(),
    teams:state.teams, team:team(), roster:state.roster.map(({id,grade,num,name,pos,school,status}) => ({id,grade,num,name,pos,school,status})),
    matches:state.matches.filter(m => ids.has(m.id)), events:evs };
  console.log('[MATCH LOG] 同期データ(JSON)↓');
  console.log(JSON.stringify(payload, null, 2));
  // await sendToGAS(payload)  ← 本番ではここで送信し、成功したときだけ下の synced=true を実行
  evs.forEach(e => e.synced = true);
  state.matches = state.matches.filter(m => !m.deleted); save.matches();
  state.events = state.events.filter(e => !(e.deleted && e.synced));   // 送り終えた削除の印は端末から消す
  save.events();
  state.meta.lastSync = payload.exportedAt; save.meta();
  toast(`${evs.length}件をJSONで出力しました（コンソールで確認できます）。記録は振り返り用に端末に残ります`);
  render();
}
