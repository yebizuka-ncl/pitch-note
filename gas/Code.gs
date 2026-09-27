/**
 * ピッチノート × Googleドライブ（スプレッドシート）連携
 * ------------------------------------------------------------
 * このスクリプトは「マスターのスプレッドシート」に付けて使います（拡張機能 → Apps Script）。
 *  - 読み込み（アプリ ← シート）：チーム・選手・予定
 *  - 書き足し（アプリ → シート）：試合・記録（id で上書き。削除した記録は「削除」列に印）
 * 最初に一度だけ setup() を実行してください。シートと見出しを作り、合言葉を設定します。
 */
const SHEETS = {
  teams:    { name:'チーム', head:['id','チーム名','表示名','カテゴリー','1stメイン','1st差し色','2ndメイン','2nd差し色'] },
  players:  { name:'選手',   head:['id','チーム','背番号','名前','学年','ポジション','所属','状態'] },
  schedule: { name:'予定',   head:['id','チーム','日付','対戦相手','種類','大会','時間(分)','本数','テーマ1','テーマ2','テーマ3'] },
  matches:  { name:'試合',   head:['id','チーム','日付','対戦相手','種類','大会','自チーム得点','相手得点','PK','記録者','テーマと評価','状態','更新日時','JSON'] },
  events:   { name:'記録',   head:['id','試合id','チーム','日付','対戦相手','ピリオド','時刻','秒','種類','攻撃側','内容','選手','背番号','結果','エリア','ゾーン','足','x','y','削除','JSON'] },
};

/** 初期設定：シートと見出しを作り、合言葉を保存する（何度実行しても大丈夫） */
function setup(){
  const ss = SpreadsheetApp.getActive();
  Object.values(SHEETS).forEach(def => {
    let sh = ss.getSheetByName(def.name);
    if(!sh) sh = ss.insertSheet(def.name);
    if(sh.getLastRow() === 0){ sh.appendRow(def.head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, def.head.length).setFontWeight('bold').setBackground('#f1e3e5'); }
  });
  const props = PropertiesService.getScriptProperties();
  if(!props.getProperty('KEY')) props.setProperty('KEY', 'pitch-' + Math.random().toString(36).slice(2, 8));
  SpreadsheetApp.getUi().alert('初期設定が終わりました。\n合言葉：' + props.getProperty('KEY') + '\n（アプリの ⚙ 設定 → Googleドライブ連携 に入力します）');
}
function onOpen(){ SpreadsheetApp.getUi().createMenu('ピッチノート').addItem('初期設定（シート作成・合言葉）', 'setup').addItem('合言葉を表示', 'showKey').addToUi(); }
function showKey(){ SpreadsheetApp.getUi().alert('合言葉：' + PropertiesService.getScriptProperties().getProperty('KEY')); }

function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function checkKey_(key){ const k = PropertiesService.getScriptProperties().getProperty('KEY'); return k && key === k; }
function sheet_(def){ return SpreadsheetApp.getActive().getSheetByName(def.name); }
function rows_(def){ const sh = sheet_(def); if(!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, def.head.length).getValues();
  return v.filter(r => r.join('') !== '').map(r => Object.fromEntries(def.head.map((h, i) => [h, r[i] instanceof Date ? Utilities.formatDate(r[i], 'Asia/Tokyo', 'yyyy-MM-dd') : r[i]]))); }

/** 読み込み：?action=ping / master */
function doGet(e){
  const p = e.parameter || {};
  if(!checkKey_(p.key)) return json_({ ok:false, error:'合言葉が違います' });
  if(p.action === 'ping') return json_({ ok:true, name:SpreadsheetApp.getActive().getName() });
  if(p.action === 'master'){
    const teams = rows_(SHEETS.teams).map(r => ({ id:String(r['id'] || ''), name:r['チーム名'], short:r['表示名'], category:r['カテゴリー'],
      kits: r['1stメイン'] ? { 1:{ a:r['1stメイン'], b:r['1st差し色'] || '#ffffff' }, 2:{ a:r['2ndメイン'] || r['1stメイン'], b:r['2nd差し色'] || '#ffffff' } } : null }));
    const players = rows_(SHEETS.players).map(r => ({ id:String(r['id'] || ''), team:r['チーム'], num:r['背番号'], name:r['名前'], grade:r['学年'], pos:r['ポジション'], school:r['所属'], status:r['状態'] }));
    const schedule = rows_(SHEETS.schedule).map(r => ({ id:String(r['id'] || (r['日付'] + '_' + r['対戦相手'])), team:r['チーム'], date:r['日付'], opponent:r['対戦相手'],
      kind:r['種類'] || '練習試合', tournament:r['大会'], min:r['時間(分)'], count:r['本数'], points:[r['テーマ1'], r['テーマ2'], r['テーマ3']].filter(String) }));
    return json_({ ok:true, teams, players, schedule });
  }
  return json_({ ok:false, error:'unknown action' });
}

/** 書き足し：POST { key, action:'push', team, roster, matches, events } */
function doPost(e){
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    const body = JSON.parse(e.postData.contents || '{}');
    if(!checkKey_(body.key)) return json_({ ok:false, error:'合言葉が違います' });
    if(body.action === 'ping') return json_({ ok:true, name:SpreadsheetApp.getActive().getName() });
    if(body.action !== 'push') return json_({ ok:false, error:'unknown action' });
    const teamName = body.team && body.team.name;
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    const mById = {}; (body.matches || []).forEach(m => mById[m.id] = m);
    const mRows = (body.matches || []).map(m => [m.id, m.teamName || teamName, m.date, m.opponent, m.kind, m.tournament || '', m.scoreUs, m.scoreThem, m.pk || '',
      m.recordersText || '', m.pointsText || '', m.endedAt ? '終了' : (m.status === 'planned' ? '予定' : '記録中'), now, JSON.stringify(m)]);
    const eRows = (body.events || []).map(ev => { const m = mById[ev.matchId] || {};
      return [ev.id, ev.matchId, m.teamName || teamName, m.date || '', m.opponent || '', ev.period, ev.clock, ev.sec, ev.type, ev.team === 'us' ? '自チーム' : '相手', ev.text || '',
        ev.name || '', ev.num || ev.oppNum || '', ev.result || '', ev.area || '', ev.zoneLabel || '', ev.foot || '', ev.x == null ? '' : ev.x, ev.y == null ? '' : ev.y, ev.deleted ? '削除' : '', JSON.stringify(ev)]; });
    const mc = upsert_(SHEETS.matches, mRows), ec = upsert_(SHEETS.events, eRows);
    // アプリで追加した選手は、シートにない場合だけ書き足す（シート側の内容を優先）
    const known = new Set(rows_(SHEETS.players).map(r => String(r['id'])).concat(rows_(SHEETS.players).map(r => r['チーム'] + '|' + r['名前'])));
    const newP = (body.roster || []).filter(p => !known.has(String(p.id)) && !known.has(teamName + '|' + p.name))
      .map(p => [p.id, teamName, p.num, p.name, p.grade, p.pos || '', p.school || '', p.status === 'retired' ? '退部' : '在籍']);
    if(newP.length) sheet_(SHEETS.players).getRange(sheet_(SHEETS.players).getLastRow() + 1, 1, newP.length, newP[0].length).setValues(newP);
    return json_({ ok:true, matches:mc, events:ec, newPlayers:newP.length });
  } catch(err){ return json_({ ok:false, error:String(err) }); }
  finally{ lock.releaseLock(); }
}
/** id（1列目）で上書き、なければ末尾に追加 */
function upsert_(def, rows){
  if(!rows.length) return 0;
  const sh = sheet_(def), last = sh.getLastRow();
  const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
  const at = {}; ids.forEach((id, i) => at[id] = i + 2);
  const add = [];
  rows.forEach(r => { const row = at[String(r[0])]; if(row) sh.getRange(row, 1, 1, r.length).setValues([r]); else add.push(r); });
  if(add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
  return rows.length;
}
