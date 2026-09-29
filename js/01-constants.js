"use strict";
// アプリの版（sw.js の VERSION と同じ番号にそろえる）
const APP_VERSION = 'pn-v37';
const APP_VER_LABEL = 'ver.' + APP_VERSION.replace('pn-v', '');
/* =========================================================
   1. 定数（ピッチ実寸と戦術モデル）
   保存する座標は常に「自チームが右へ攻める」向き（x=0 自陣ゴール / x=105 相手ゴール）。
   画面の表示だけを、ピリオドごとの陣地に合わせて180°回転させる。
   ========================================================= */
const THIRDS = [
  { id:'D', name:'ディフェンシブサード', short:'守備' },
  { id:'M', name:'ミドルサード',         short:'中盤' },
  { id:'A', name:'アタッキングサード',   short:'攻撃' },
];
const LANES = [
  { id:1, name:'左大外', short:'左大外' }, { id:2, name:'左ハーフスペース', short:'左HS' }, { id:3, name:'中央', short:'中央' },
  { id:4, name:'右ハーフスペース', short:'右HS' }, { id:5, name:'右大外', short:'右大外' },
];
const THIRD_X = [0, 35, 70, 105];
const LANE_Y  = [0, 13.84, 24.84, 43.16, 54.16, 68];  // レーン境界＝PA・ゴールエリアの縦ライン
const zoneOf = (x, y) => { const t = x < 35 ? 0 : x < 70 ? 1 : 2; let l = 0; while(l < 4 && y >= LANE_Y[l+1]) l++; return { third:THIRDS[t].id, lane:LANES[l].id, ti:t, li:l }; };
const zoneLabel = (t, l) => `${THIRDS.find(x=>x.id===t).name}・${LANES.find(x=>x.id===l).name}`;
const zoneShort = key => { const [t,l] = key.split('-'); return `${THIRDS.find(x=>x.id===t).short}・${LANES.find(x=>x.id===+l).short}`; };
const areaOf = (x, y, team) => { const dx = Math.abs((team === 'us' ? 105 : 0) - x);
  if(dx <= 5.5 && y >= 24.84 && y <= 43.16) return 'GA'; if(dx <= 16.5 && y >= 13.84 && y <= 54.16) return 'PA'; return 'OUT'; };
const distOf = (x, y, team) => Math.round(Math.hypot((team === 'us' ? 105 : 0) - x, 34 - y));
const AREA = { GA:'ゴールエリア内', PA:'PA内', OUT:'PA外' };
const RESULTS = [
  { id:'goal', label:'ゴール', en:'GOAL', sub:'' }, { id:'on', label:'枠内', en:'ON TARGET', sub:'GKがセーブ' },
  { id:'off', label:'枠外', en:'OFF TARGET', sub:'外れた・バーの上' }, { id:'block', label:'ブロック', en:'BLOCKED', sub:'DFに当たった' },
];
const RES = Object.fromEntries(RESULTS.map(r => [r.id, r]));

/* ---------- 得点・失点の分類 ---------- */
const PHASES = [
  { id:'setpiece', label:'セットプレー' }, { id:'transition', label:'奪ってすぐ（速攻）', hint:'奪って10秒以内' },
  { id:'possession', label:'つないで崩す', hint:'パスをつないで' }, { id:'direct', label:'ロングボール・セカンド', hint:'蹴り合い・こぼれ球' },
];
const SP_DETAILS = [
  { id:'ck', label:'CK' }, { id:'fk_d', label:'FK（直接）' }, { id:'fk_i', label:'FK（間接）' },
  { id:'throw', label:'スローイン' }, { id:'pk', label:'PK' }, { id:'kickoff', label:'キックオフ' },
];
const WIN_DETAILS = [
  { id:'intercept', label:'パスカット' }, { id:'duel', label:'1対1で奪う' }, { id:'error', label:'相手のミス' },
  { id:'gk', label:'GK・自陣から' }, { id:'second', label:'こぼれ球を拾う' }, { id:'restart', label:'リスタート' },
];
const LASTPASS = [
  { id:'cross', label:'クロス' }, { id:'cutback', label:'カットバック', hint:'マイナスのクロス' },
  { id:'through', label:'スルーパス' }, { id:'combo', label:'縦パス・ワンツー' },
  { id:'dribble', label:'ドリブル突破', hint:'個人で' }, { id:'rebound', label:'こぼれ球', hint:'リバウンド' },
  { id:'long', label:'ミドル・ロング', hint:'遠目から' }, { id:'direct', label:'セットプレー直接' },
];
const FEET = [ { id:'right', label:'右足' }, { id:'left', label:'左足' }, { id:'head', label:'ヘディング' }, { id:'other', label:'その他' } ];
const CK_TYPES = [ { id:'L-cross', side:'L', style:'cross', label:'左CK・クロス' }, { id:'L-short', side:'L', style:'short', label:'左CK・ショート' },
                   { id:'R-cross', side:'R', style:'cross', label:'右CK・クロス' }, { id:'R-short', side:'R', style:'short', label:'右CK・ショート' },
                   { id:'L', side:'L', style:null, label:'左CK' }, { id:'R', side:'R', style:null, label:'右CK' } ];
const CK_SIDES = [ { id:'L', label:'左CK' }, { id:'R', label:'右CK' } ];   // 今の記録は左右だけ（蹴り方は作図に残す）
const FK_KINDS = [ { id:'direct', label:'直接FK' }, { id:'indirect', label:'間接FK' } ];
const FK_PLAYS = [ { id:'shot', label:'直接シュート' }, { id:'cross', label:'クロス・放り込み' }, { id:'short', label:'つないだ' }, { id:'kick', label:'シュート以外' } ];
const FK_PLAYS2 = [ { id:'shot', label:'直接シュート' }, { id:'kick', label:'シュート以外' } ];   // 今の記録は2択（中身は作図に残す）
const fkPlay2 = e => e.fkPlay === 'shot' ? 'shot' : 'kick';
const POSITIONS = ['GK','DF','MF','FW'];
const TOUCH = [ { id:'first', label:'ダイレクト' }, { id:'control', label:'トラップして' } ];
const ALL_DETAILS = [...SP_DETAILS, ...WIN_DETAILS];
const lbl = (arr, id) => (arr.find(x => x.id === id) || {}).label || '';

/* ---------- 給水・動画マーク ---------- */
const BREAKS = { water:{ label:'飲水タイム', icon:'💧', min:1 }, cool:{ label:'クーリングブレイク', icon:'🧊', min:3 } };
const MARK_TAGS = [
  { id:'good', label:'👍 ナイスプレー' }, { id:'issue', label:'⚠️ 課題' }, { id:'chance', label:'🔥 決定機' },
  { id:'danger', label:'🚨 ピンチ' }, { id:'tactic', label:'🧠 戦術の確認' }, { id:'ref', label:'🟨 判定・ファウル' },
];

/* ---------- フォーメーション ---------- */
const B4 = ['LSB','LCB','RCB','RSB'], B3 = ['LCB','CB','RCB'], B5 = ['LWB','LCB','CB','RCB','RWB'];
const FORMATIONS = {
  '4-4-2':[B4,['LSH','LCH','RCH','RSH'],['LCF','RCF']], '4-1-2-1-2':[B4,['DM'],['LCH','RCH'],['OH'],['LCF','RCF']],
  '4-2-3-1':[B4,['LDM','RDM'],['LSH','OH','RSH'],['CF']], '4-3-3':[B4,['DM'],['LIH','RIH'],['LWG','CF','RWG']],
  '4-1-4-1':[B4,['DM'],['LSH','LCH','RCH','RSH'],['CF']], '4-3-1-2':[B4,['LCH','CH','RCH'],['OH'],['LCF','RCF']],
  '4-2-2-2':[B4,['LDM','RDM'],['LOH','ROH'],['LCF','RCF']], '4-3-2-1':[B4,['LCH','CH','RCH'],['LSS','RSS'],['CF']],
  '3-4-2-1':[B3,['LWB','LCH','RCH','RWB'],['LSS','RSS'],['CF']], '3-4-1-2':[B3,['LWB','LCH','RCH','RWB'],['OH'],['LCF','RCF']],
  '3-5-2':[B3,['LWB','DM','RWB'],['LIH','RIH'],['LCF','RCF']], '3-4-3':[B3,['LWB','LCH','RCH','RWB'],['LWG','CF','RWG']],
  '3-1-4-2':[B3,['DM'],['LWB','LCH','RCH','RWB'],['LCF','RCF']], '5-3-2':[B5,['LCH','CH','RCH'],['LCF','RCF']],
  '5-4-1':[B5,['LSH','LCH','RCH','RSH'],['CF']],
};
const FM_GROUPS = [
  ['4バック', ['4-4-2','4-1-2-1-2','4-2-3-1','4-3-3','4-1-4-1','4-3-1-2','4-2-2-2','4-3-2-1']],
  ['3バック', ['3-4-2-1','3-4-1-2','3-5-2','3-4-3','3-1-4-2']],
  ['5バック', ['5-3-2','5-4-1']],
];
// ポジション名（日本でよく使う呼び方に）と、スタメン自動配置で使うグループ
const POS_NAME = { SB:'SB', CB:'CB', WB:'WB', DM:'DMF', CH:'CMF', OH:'OMF', SH:'SH', IH:'IH', SS:'SS', WG:'WG', CF:'CF' };
const POS_FULL = { SS:'シャドー' };
const POS_GROUP = { SB:'DF', CB:'DF', WB:'DF', DM:'MF', CH:'MF', OH:'MF', SH:'MF', IH:'MF', SS:'MF', WG:'FW', CF:'FW' };
function slotsOf(shape, team){
  const lines = FORMATIONS[shape]; const L = lines.length;
  const out = [{ label:'GK', full:'GK', group:'GK', x:4, y:34 }];
  lines.forEach((ln, i) => { const x = 13 + i * (35 / (L - 1));
    ln.forEach((lab, j) => { const side = /^[LR]..$/.test(lab) ? lab[0] : '', base = side ? lab.slice(1) : lab;
      out.push({ label:POS_NAME[base] || base, full:(side === 'L' ? '左' : side === 'R' ? '右' : '') + (POS_FULL[base] || POS_NAME[base] || base),
                 group:POS_GROUP[base] || 'MF', x, y:7 + 54 * (j + .5) / ln.length }); }); });
  if(team === 'them') out.forEach(s => { s.x = 105 - s.x; s.y = 68 - s.y; });
  return out;
}

const STATUSES = [
  { id:'present', label:'参加', color:'var(--st-present)' }, { id:'injured', label:'ケガ', color:'var(--st-injured)' },
  { id:'absent',  label:'欠席', color:'var(--st-absent)' },  { id:'notcalled', label:'召集外', color:'var(--st-notcalled)' },
];
const DEFAULT_ROSTER_ = [
  { id:'p01', grade:3, num:1,  name:'佐藤 陽翔', pos:'GK' }, { id:'p02', grade:3, num:4,  name:'鈴木 蓮', pos:'DF' },
  { id:'p03', grade:3, num:9,  name:'高橋 湊', pos:'FW' },   { id:'p04', grade:3, num:10, name:'田中 大翔', pos:'MF' },
  { id:'p05', grade:2, num:3,  name:'中村 悠真', pos:'DF' }, { id:'p06', grade:2, num:5,  name:'渡辺 颯', pos:'DF' },
  { id:'p07', grade:2, num:7,  name:'伊藤 樹', pos:'MF' },   { id:'p08', grade:2, num:8,  name:'山本 陸', pos:'MF' },
  { id:'p09', grade:1, num:2,  name:'吉田 蒼', pos:'DF' },   { id:'p10', grade:1, num:6,  name:'加藤 律', pos:'MF' },
  { id:'p11', grade:1, num:11, name:'小林 奏太', pos:'FW' }, { id:'p12', grade:1, num:13, name:'山田 朝陽', pos:'FW' },
  { id:'p13', grade:1, num:21, name:'木村 悠斗', pos:'GK' },
].map(p => ({ ...p, status:'present' }));
const DEFAULT_ROSTER = DEFAULT_ROSTER_;

