// Quoridor 9x9 — Clean single-file implementation (2 players + optional AI)
// Quoridor 9x9 — Clean implementation
const BOARD_N = 9;
const MAX_WALLS = 10;

const boardEl = document.getElementById('board');
const turnLabel = document.getElementById('turnLabel');
const wallsLabel = document.getElementById('wallsLabel');
const newGameBtn = document.getElementById('newGameBtn');
const aiToggle = document.getElementById('aiToggle');

let state = null;
let previewEl = null;
let isTouch = false;


function mkState(){
  return {
    pawns: [ {x:4,y:8}, {x:4,y:0} ],
    wallsH: new Set(),
    wallsV: new Set(),
    wallsLeft: [MAX_WALLS, MAX_WALLS],
    turn: 0,
    selected: null,
    gameOver: false,
    moves: [],
    orient: 'h'
  };
}

function coordKey(x,y){ return `${x},${y}`; }
function inBounds(x,y){ return x>=0 && x<BOARD_N && y>=0 && y<BOARD_N; }
function wallExistsH(x,y){ return state.wallsH.has(coordKey(x,y)); }
function wallExistsV(x,y){ return state.wallsV.has(coordKey(x,y)); }

function addMoveLog(text){ state.moves.push(text); renderMoveLog(); }
function renderMoveLog(){ const list = document.getElementById('moves'); if(!list) return; list.innerHTML=''; state.moves.forEach((m,i)=>{ const li=document.createElement('li'); li.textContent = `${i+1}. ${m}`; list.appendChild(li); }); }

function computeCell(){
  // Prefer container width (boardWrap) to avoid self-referential shrinking
  const wrap = document.getElementById('boardWrap') || boardEl.parentElement || document.documentElement;
  let avail = Math.max(0, Math.floor((wrap.getBoundingClientRect && wrap.getBoundingClientRect().width) || wrap.clientWidth || window.innerWidth));
  const maxByHeight = Math.floor(window.innerHeight * 0.75);
  avail = Math.min(avail, maxByHeight || avail);
  if(!avail || avail < BOARD_N) avail = Math.max(360, BOARD_N*40);
  const floatCell = avail / BOARD_N;
  let cell = Math.round(floatCell);
  // ensure we never overflow the container
  if(cell * BOARD_N > avail) cell = Math.floor(floatCell);
  cell = Math.max(1, cell);
  const boardPx = cell * BOARD_N;
  // update CSS variables so CSS-based elements (walls) match JS sizes
  document.documentElement.style.setProperty('--board-size', `${boardPx}px`);
  document.documentElement.style.setProperty('--cell-size', `${cell}px`);
  const wallThickness = Math.max(8, Math.floor(cell*0.12));
  document.documentElement.style.setProperty('--wall-thickness', `${wallThickness}px`);
  return { cell, size: boardPx, avail, wallThickness };
}

function buildBoard(){
  boardEl.innerHTML = '';
  previewEl = null;
  const { cell, size: boardPx, avail } = computeCell();
  boardEl.style.width = `${boardPx}px`;
  boardEl.style.height = `${boardPx}px`;
  // center board inside wrapper to absorb leftover pixels
  try{ const wrap = document.getElementById('boardWrap') || boardEl.parentElement; if(wrap){ const left = Math.max(0, Math.round((avail - boardPx)/2)); boardEl.style.marginLeft = left + 'px'; } }catch(e){}

  for(let y=0;y<BOARD_N;y++){
    for(let x=0;x<BOARD_N;x++){
      const el = document.createElement('div');
      el.className = 'cell';
      el.style.left = `${x*cell}px`;
      el.style.top = `${y*cell}px`;
      el.style.width = `${cell}px`;
      el.style.height = `${cell}px`;
      el.dataset.x = x;
      el.dataset.y = y;
      el.addEventListener('click', onCellClick);
      boardEl.appendChild(el);
    }
  }

  for(let y=0;y<BOARD_N-1;y++){
    for(let x=0;x<BOARD_N-1;x++){
      const slot = document.createElement('div');
      slot.className = 'wall-slot';
      // make slots larger on touch devices so they are easy to tap
      const slotSize = isTouch ? Math.floor(cell * 2) : Math.max(12, Math.floor(cell * 0.6));
      const cx = x*cell + cell;
      const cy = y*cell + cell;
      const half = Math.floor(slotSize/2);
      slot.style.left = `${cx-half}px`;
      slot.style.top = `${cy-half}px`;
      slot.style.width = `${slotSize}px`;
      slot.style.height = `${slotSize}px`;
      slot.style.cursor = 'pointer';
      slot.dataset.x = x; slot.dataset.y = y;
      slot.addEventListener('click', (e)=>{ e.stopPropagation(); onWallSlotClick(x,y); });
      slot.addEventListener('mouseenter', ()=>onWallSlotHover(x,y,true));
      slot.addEventListener('mouseleave', ()=>onWallSlotHover(x,y,false));
      slot.addEventListener('contextmenu', (e)=>{ e.preventDefault(); state.orient = state.orient==='h'? 'v' : 'h'; const r=document.querySelector(`input[name="orient"][value="${state.orient}"]`); if(r) r.checked=true; onWallSlotHover(x,y,true); });
      boardEl.appendChild(slot);
    }
  }

  // ensure board-level handlers for clicks/touches
  boardEl.removeEventListener('click', boardPointerHandler);
  boardEl.removeEventListener('touchstart', boardPointerHandler);
  boardEl.addEventListener('click', boardPointerHandler);
  boardEl.addEventListener('touchstart', boardPointerHandler, {passive:false});
}

function clearHighlights(){ Array.from(boardEl.querySelectorAll('.move-dot')).forEach(n=>n.remove()); if(previewEl){ previewEl.remove(); previewEl=null; } }

function render(){
  if(!boardEl.children.length) buildBoard();
  Array.from(boardEl.querySelectorAll('.pawn, .wall')).forEach(n=>n.remove());
  clearHighlights();
  const { cell } = computeCell();
  boardEl.style.width = `${cell*BOARD_N}px`;
  boardEl.style.height = `${cell*BOARD_N}px`;
  const wallThickness = Math.max(8, Math.floor(cell*0.12));

  state.pawns.forEach((p,i)=>{
    const sel = `.cell[data-x="${p.x}"][data-y="${p.y}"]`;
    const ce = boardEl.querySelector(sel);
    if(ce){ const e = document.createElement('div'); e.className = 'pawn p'+(i+1); e.addEventListener('click', (ev)=>{ onPawnClick(i); }); const prev = ce.querySelector('.pawn'); if(prev) prev.remove(); ce.appendChild(e); }
  });


  state.wallsH.forEach(k=>{
    const [x,y] = k.split(',').map(Number);
    const w = document.createElement('div');
    w.className='wall h';
    const half = Math.round(wallThickness/2);
    w.style.left = `${x*cell}px`;
    w.style.top = `${(y+1)*cell - half}px`;
    boardEl.appendChild(w);
  });
  state.wallsV.forEach(k=>{
    const [x,y] = k.split(',').map(Number);
    const w = document.createElement('div');
    w.className='wall v';
    const half = Math.round(wallThickness/2);
    w.style.left = `${(x+1)*cell - half}px`;
    w.style.top = `${y*cell}px`;
    boardEl.appendChild(w);
  });

  if(turnLabel) turnLabel.textContent = `플레이어 ${state.turn+1}`;
  if(wallsLabel) wallsLabel.textContent = `벽: P1 ${state.wallsLeft[0]} | P2 ${state.wallsLeft[1]}`;

  // show winner when game over
  const existingOverlay = document.getElementById('gameOverOverlay');
  if(state.gameOver){
    let winner = null;
    if(state.pawns[0].y === 0) winner = 1;
    else if(state.pawns[1].y === BOARD_N-1) winner = 2;
    const text = winner ? `플레이어 ${winner} 승리!` : `게임 종료`;
    if(turnLabel) turnLabel.textContent = text;
    if(!existingOverlay){
      const ov = document.createElement('div'); ov.id = 'gameOverOverlay'; ov.className = 'game-over-overlay';
      const msg = document.createElement('div'); msg.className='game-over-msg'; msg.textContent = text;
      const btn = document.createElement('button'); btn.textContent = '다음판'; btn.className='next-game-btn'; btn.addEventListener('click', ()=>{ state = mkState(); render(); });
      ov.appendChild(msg); ov.appendChild(btn); boardEl.appendChild(ov);
    } else {
      existingOverlay.querySelector('.game-over-msg').textContent = text;
    }
  } else {
    if(existingOverlay) existingOverlay.remove();
  }

  Array.from(boardEl.querySelectorAll('.cell.highlight')).forEach(n=>n.classList.remove('highlight','primary','secondary'));
  if(state.selected && state.selected.type==='pawn'){
    const moves = legalMoves(state.selected.player);
    moves.forEach(m=>{ const ce = boardEl.querySelector(`.cell[data-x="${m.x}"][data-y="${m.y}"]`); if(ce){ ce.classList.add('highlight'); if(state.turn===state.selected.player) ce.classList.add('primary'); else ce.classList.add('secondary'); } });
  }

  renderMoveLog();

  // visual flip disabled per user request

  if(!state.gameOver && aiToggle && aiToggle.checked && state.turn===1){ setTimeout(aiMove, 220); }
}

function legalMoves(player){
  const other = 1-player; const p = state.pawns[player]; const o = state.pawns[other];
  const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]; const res = [];
  for(const d of dirs){ const nx=p.x+d.dx, ny=p.y+d.dy; if(!inBounds(nx,ny)) continue; if(isBlocked(p.x,p.y,nx,ny)) continue; if(nx===o.x && ny===o.y){ const jx=nx+d.dx, jy=ny+d.dy; if(inBounds(jx,jy) && !isBlocked(nx,ny,jx,jy)){ res.push({x:jx,y:jy}); continue; } const left={dx:-d.dy,dy:d.dx}; const right={dx:d.dy,dy:-d.dx}; const lx=nx+left.dx, ly=ny+left.dy; const rx=nx+right.dx, ry=ny+right.dy; if(inBounds(lx,ly) && !isBlocked(nx,ny,lx,ly)) res.push({x:lx,y:ly}); if(inBounds(rx,ry) && !isBlocked(nx,ny,rx,ry)) res.push({x:rx,y:ry}); } else res.push({x:nx,y:ny}); }
  return res.filter((v,i,a)=>a.findIndex(x=>x.x===v.x&&x.y===v.y)===i);
}

function isBlocked(x1,y1,x2,y2){
  const dx = x2-x1, dy = y2-y1;
  if(Math.abs(dx)+Math.abs(dy) !== 1) return true;
  if(dx===1){
    // moving right: check vertical wall at (x1,y1) or above (x1,y1-1)
    if(wallExistsV(x1,y1) || wallExistsV(x1, y1-1)) return true;
  }
  if(dx===-1){
    // moving left: check vertical wall at destination x2 or above
    if(wallExistsV(x2,y2) || wallExistsV(x2, y2-1)) return true;
  }
  if(dy===1){
    // moving down: check horizontal wall at (x1,y1) or to the left (x1-1,y1)
    if(wallExistsH(x1,y1) || wallExistsH(x1-1, y1)) return true;
  }
  if(dy===-1){
    // moving up: check horizontal wall at destination or to the left
    if(wallExistsH(x2,y2) || wallExistsH(x2-1, y2)) return true;
  }
  return false;
}

function bfsPathExists(start, targetCheck){
  const q=[ start ]; const seen=new Set([coordKey(start.x,start.y)]);
  while(q.length){ const cur=q.shift(); if(targetCheck(cur)) return true; const dirs=[{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]; for(const d of dirs){ const nx=cur.x+d.dx, ny=cur.y+d.dy; if(!inBounds(nx,ny)) continue; if(isBlocked(cur.x,cur.y,nx,ny)) continue; const k=coordKey(nx,ny); if(seen.has(k)) continue; seen.add(k); q.push({x:nx,y:ny}); } } return false; }

function canPlaceWallH(x,y){
  if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return false;
  if(wallExistsH(x,y) || wallExistsH(x-1,y) || wallExistsH(x+1,y)) return false;
  // disallow direct crossing '+' with existing vertical wall at same slot
  if(wallExistsV(x,y)) return false;
  // disallow crossing existing walls (both H and V) by rectangle intersection (fallback)
  if(crossesExisting('h',x,y)) return false;
  state.wallsH.add(coordKey(x,y));
  const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1);
  state.wallsH.delete(coordKey(x,y));
  return ok;
}

function canPlaceWallV(x,y){
  if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return false;
  if(wallExistsV(x,y) || wallExistsV(x,y-1) || wallExistsV(x,y+1)) return false;
  // disallow direct crossing '+' with existing horizontal wall at same slot
  if(wallExistsH(x,y)) return false;
  if(crossesExisting('v',x,y)) return false;
  state.wallsV.add(coordKey(x,y));
  const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1);
  state.wallsV.delete(coordKey(x,y));
  return ok;
}

function rectsForWalls(){
  const {cell} = computeCell();
  const thickness = Math.max(8, Math.floor(cell*0.12));
  const rects = [];
  state.wallsH.forEach(k=>{ const [x,y]=k.split(',').map(Number); const left = x*cell; const top = (y+1)*cell - Math.floor(thickness/2); rects.push({left,top,right:left + (cell*2 + thickness), bottom: top + thickness, type:'h', x,y}); });
  state.wallsV.forEach(k=>{ const [x,y]=k.split(',').map(Number); const left = (x+1)*cell - Math.floor(thickness/2); const top = y*cell; rects.push({left,top,right:left + thickness, bottom: top + (cell*2 + thickness), type:'v', x,y}); });
  return rects;
}

function rectForCandidate(orient,x,y){ const {cell} = computeCell(); const thickness = Math.max(8, Math.floor(cell*0.12)); if(orient==='h'){ const left = x*cell; const top = (y+1)*cell - Math.floor(thickness/2); return {left,top,right:left + (cell*2 + thickness), bottom: top + thickness}; } else { const left = (x+1)*cell - Math.floor(thickness/2); const top = y*cell; return {left,top,right:left + thickness, bottom: top + (cell*2 + thickness)}; } }

function rectsIntersect(a,b){
  // compute overlap amounts
  const ow = Math.min(a.right,b.right) - Math.max(a.left,b.left);
  const oh = Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top);
  // no overlap or pure edge-touching -> OK
  if(ow <= 0 || oh <= 0) return false;
  // allow tiny overlaps caused by rounding at edges (tolerance)
  const TOL = 6; // pixels
  if(ow <= TOL || oh <= TOL) return false;
  // otherwise treat as intersecting
  return true;
}

function canPlaceWallReason(orient,x,y){
  if(orient==='h'){
    if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return {ok:false,reason:'out-of-bounds'};
    if(wallExistsH(x,y) || wallExistsH(x-1,y) || wallExistsH(x+1,y)) return {ok:false,reason:'conflict_same'};
    // disallow direct '+' crossing with vertical at same slot
    if(wallExistsV(x,y)) return {ok:false,reason:'crosses_existing'};
    if(crossesExisting('h',x,y)) return {ok:false,reason:'crosses_existing'};
    state.wallsH.add(coordKey(x,y));
    const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1);
    state.wallsH.delete(coordKey(x,y));
    if(!ok) return {ok:false,reason:'blocks_path'};
    return {ok:true,reason:'ok'};
  } else {
    if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return {ok:false,reason:'out-of-bounds'};
    if(wallExistsV(x,y) || wallExistsV(x,y-1) || wallExistsV(x,y+1)) return {ok:false,reason:'conflict_same'};
    // disallow direct '+' crossing with horizontal at same slot
    if(wallExistsH(x,y)) return {ok:false,reason:'crosses_existing'};
    if(crossesExisting('v',x,y)) return {ok:false,reason:'crosses_existing'};
    state.wallsV.add(coordKey(x,y));
    const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1);
    state.wallsV.delete(coordKey(x,y));
    if(!ok) return {ok:false,reason:'blocks_path'};
    return {ok:true,reason:'ok'};
  }
}

function showToast(text){ try{ const t = document.createElement('div'); t.className='placement-toast'; t.textContent = text; Object.assign(t.style,{position:'absolute',right:'8px',top:'8px',padding:'8px 10px',background:'rgba(0,0,0,0.8)',color:'#fff',borderRadius:'6px',zIndex:999}); boardEl.appendChild(t); setTimeout(()=>{ t.remove(); },1600); }catch(e){ console.log('toast',text); } }

// enhanced placement checks: disallow rectangles that intersect any existing wall
function crossesExisting(orient,x,y){
  const cand = rectForCandidate(orient,x,y);
  const rects = rectsForWalls();
  const TOL_EDGE = 8; // allow small endpoint overlaps
  for(const r of rects){
    // compute raw overlap
    const ow = Math.min(cand.right, r.right) - Math.max(cand.left, r.left);
    const oh = Math.min(cand.bottom, r.bottom) - Math.max(cand.top, r.top);
    if(ow <= 0 || oh <= 0) continue; // no overlap
    // require significant overlap in both dimensions to be a crossing
    if(ow > TOL_EDGE && oh > TOL_EDGE) return true;
    // otherwise treat as touching/acceptable and continue
  }
  return false;
}

function canPlaceWallH(x,y){
  if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return false;
  if(wallExistsH(x,y) || wallExistsH(x-1,y)) return false;
  // disallow crossing existing walls (both H and V) by rectangle intersection
  if(crossesExisting('h',x,y)) return false;
  state.wallsH.add(coordKey(x,y));
  const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1);
  state.wallsH.delete(coordKey(x,y));
  return ok;
}

function canPlaceWallV(x,y){
  if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return false;
  if(wallExistsV(x,y) || wallExistsV(x,y-1)) return false;
  if(crossesExisting('v',x,y)) return false;
  state.wallsV.add(coordKey(x,y));
  const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1);
  state.wallsV.delete(coordKey(x,y));
  return ok;
}

function placeWallH(x,y){ state.wallsH.add(coordKey(x,y)); state.wallsLeft[state.turn]--; addMoveLog(`P${state.turn+1} 벽 H ${x},${y}`); state.turn=1-state.turn; render(); }
function placeWallV(x,y){ state.wallsV.add(coordKey(x,y)); state.wallsLeft[state.turn]--; addMoveLog(`P${state.turn+1} 벽 V ${x},${y}`); state.turn=1-state.turn; render(); }

function onPawnClick(player){ if(state.gameOver) return; if(state.turn!==player) return; // toggle selection on second click
  if(state.selected && state.selected.type==='pawn' && state.selected.player===player){ state.selected = null; } else { state.selected={type:'pawn',player}; }
  render(); }

function handleCellSelection(x,y){
  if(state.gameOver) return;
  if(state.selected && state.selected.type==='pawn'){
    const moves=legalMoves(state.selected.player);
    if(moves.find(m=>m.x===x&&m.y===y)){
      state.pawns[state.selected.player]={x,y};
      addMoveLog(`P${state.selected.player+1} 이동 ${x},${y}`);
      if((state.pawns[0].y===0)||(state.pawns[1].y===BOARD_N-1)){
        state.gameOver=true;
      }
      state.turn=1-state.turn; state.selected=null; render();
    }
  }
}

function onCellClick(e){
  const x=Number(e.currentTarget.dataset.x), y=Number(e.currentTarget.dataset.y);
  handleCellSelection(x,y);
}

function boardPointerHandler(e){
  // support both mouse click and touch
  let clientX, clientY;
  if(e.touches && e.touches[0]){ clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; e.preventDefault(); }
  else { clientX = e.clientX; clientY = e.clientY; }
  const el = document.elementFromPoint(clientX, clientY);
  if(!el) return;
  const cell = el.closest ? el.closest('.cell') : findAncestorByClass(el,'cell');
  if(cell) handleCellSelection(Number(cell.dataset.x), Number(cell.dataset.y));
}

function findAncestorByClass(el, cls){ while(el && !el.classList.contains(cls)) el = el.parentElement; return el; }

function onWallSlotClick(x,y){
  // disable wall placement while pawn selection active
  if(state.selected && state.selected.type==='pawn') return;
  if(state.gameOver) return;
  if(state.wallsLeft[state.turn] <= 0) return;
  const orient = state.orient || 'h';
  const r = canPlaceWallReason(orient,x,y);
  if(r.ok){
    if(orient==='h') placeWallH(x,y); else placeWallV(x,y);
  } else {
    // show friendly reason for why placement is blocked
    const map = {
      'out-of-bounds':'해당 위치는 보드 범위를 벗어납니다.',
      'conflict_same':'이미 해당 위치에 벽이 있거나 인접한 벽이 있습니다.',
      'crosses_existing':'다른 벽과 교차합니다.',
      'blocks_path':'이 벽은 상대의 도달 경로를 차단합니다.'
    };
    const msg = map[r.reason] || '배치할 수 없습니다.';
    showToast(msg);
    console.log('wall place denied', orient, x, y, r.reason);
  }
}

function onWallSlotHover(x,y,enter){
  if(!enter){ if(previewEl){ previewEl.remove(); previewEl=null; } return; }
  if(state.selected && state.selected.type==='pawn') return; // suppress preview while selecting pawn
  if(previewEl) previewEl.remove();
  const {cell}=computeCell(); const wallThickness=Math.max(8, Math.floor(cell*0.12));
  const p=document.createElement('div'); p.className='wall-preview '+(state.orient==='h'?'h':'v');
  if(state.orient==='h'){
    const half = Math.round(wallThickness/2);
    p.style.left=`${x*cell}px`;
    p.style.top=`${(y+1)*cell - half}px`;
    p.className = 'wall-preview h';
  } else {
    const half = Math.round(wallThickness/2);
    p.style.left=`${(x+1)*cell - half}px`;
    p.style.top=`${y*cell}px`;
    p.className = 'wall-preview v';
  }
  const reason = canPlaceWallReason(state.orient, x, y);
  p.style.background = reason.ok? 'rgba(0,160,0,0.35)' : 'rgba(160,0,0,0.3)';
  if(!reason.ok) console.log('wall preview deny:', reason.reason, state.orient, x, y);
  previewEl = p; boardEl.appendChild(p);
}

function nextStepTowardsGoal(player){ const start=state.pawns[player]; const target=(player===0)?0:BOARD_N-1; const q=[{x:start.x,y:start.y,prev:null}]; const seen=new Set([coordKey(start.x,start.y)]); while(q.length){ const cur=q.shift(); if(cur.y===target){ let node=cur; while(node.prev && node.prev.prev) node=node.prev; return {x:node.x,y:node.y}; } const nbs=legalMovesSimple(cur.x,cur.y); for(const nb of nbs){ const k=coordKey(nb.x,nb.y); if(seen.has(k)) continue; seen.add(k); q.push({x:nb.x,y:nb.y,prev:cur}); } } return null; }

function legalMovesSimple(x,y){ const dirs=[{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]; const res=[]; for(const d of dirs){ const nx=x+d.dx, ny=y+d.dy; if(!inBounds(nx,ny)) continue; if(!isBlocked(x,y,nx,ny)) res.push({x:nx,y:ny}); } return res; }

function shortestPathLength(player){
  const start = state.pawns[player];
  const targetRow = (player===0)?0:BOARD_N-1;
  const q = [{x:start.x,y:start.y,d:0}];
  const seen = new Set([coordKey(start.x,start.y)]);
  while(q.length){ const cur = q.shift(); if(cur.y===targetRow) return cur.d; const nbs = legalMovesSimple(cur.x,cur.y); for(const nb of nbs){ const k = coordKey(nb.x,nb.y); if(seen.has(k)) continue; seen.add(k); q.push({x:nb.x,y:nb.y,d:cur.d+1}); } }
  return Infinity;
}

function aiMove(){
  if(state.gameOver) return;
  const me = 1;
  const opp = 0;
  const myBefore = shortestPathLength(me);
  const oppBefore = shortestPathLength(opp);

  // try wall placements and score them by (oppIncrease - ownIncrease*penalty)
  let best = null;
  let bestScore = -Infinity;
  if(state.wallsLeft[me] > 0){
    for(let y=0;y<BOARD_N-1;y++){
      for(let x=0;x<BOARD_N-1;x++){
        for(const orient of ['h','v']){
          const r = canPlaceWallReason(orient,x,y);
          if(!r.ok) continue;
          // simulate place
          if(orient==='h') state.wallsH.add(coordKey(x,y)); else state.wallsV.add(coordKey(x,y));
          const oppAfter = shortestPathLength(opp);
          const meAfter = shortestPathLength(me);
          if(orient==='h') state.wallsH.delete(coordKey(x,y)); else state.wallsV.delete(coordKey(x,y));

          const oppDelta = (oppAfter===Infinity)?1000:(oppAfter - oppBefore);
          const myDelta = (meAfter===Infinity)?1000:(meAfter - myBefore);
          const score = oppDelta - 0.9 * myDelta;
          // prefer placements that increase opponent path while not hurting self
          if(score > bestScore + 1e-6){ bestScore = score; best = {x,y,orient,oppAfter,meAfter,score}; }
        }
      }
    }
  }

  // If a worthwhile wall exists (positive score), place it
  if(best && bestScore > 0.5){
    if(best.orient==='h') placeWallH(best.x,best.y); else placeWallV(best.x,best.y);
    addMoveLog(`AI 벽 ${best.orient.toUpperCase()} ${best.x},${best.y}`);
    return;
  }

  // Otherwise choose the best move towards goal (shortest-path-aware)
  const moves = legalMoves(1);
  if(moves.length){
    // score moves by resulting shortest path length (lower is better), tie-breaker: also increase opp path
    let bestMove = null; let bestMoveScore = Infinity;
    for(const m of moves){
      const prev = {x: state.pawns[1].x, y: state.pawns[1].y};
      state.pawns[1] = {x:m.x,y:m.y};
      const myLen = shortestPathLength(1);
      const oppLen = shortestPathLength(0);
      state.pawns[1] = prev;
      const score = myLen - 0.2 * (oppLen - oppBefore);
      if(score < bestMoveScore - 1e-6){ bestMoveScore = score; bestMove = m; }
    }
    if(bestMove){ state.pawns[1] = {x:bestMove.x,y:bestMove.y}; addMoveLog(`AI 이동 ${bestMove.x},${bestMove.y}`); if(state.pawns[1].y===BOARD_N-1) state.gameOver=true; state.turn=0; render(); }
  }
}

function setupControls(){
  if(newGameBtn) newGameBtn.addEventListener('click', ()=>{
    const sel = document.querySelector('input[name="orient"]:checked');
    const orient = sel ? sel.value : 'h';
    state = mkState();
    state.orient = orient;
    render();
  });
  const orEls=document.querySelectorAll('input[name="orient"]');
  orEls.forEach(r=>r.addEventListener('change',(e)=>{ if(e.target.checked) state.orient=e.target.value; }));
  const r=document.querySelector(`input[name="orient"][value="${state?state.orient:'h'}"]`);
  if(r) r.checked=true;
}

// wire rules button after DOM available
document.addEventListener('DOMContentLoaded', ()=>{
  const rulesBtn = document.getElementById('rulesBtn'); if(rulesBtn) rulesBtn.addEventListener('click', showRules);
});

// Rules overlay
function createRulesOverlay(){
  if(document.getElementById('rulesOverlay')) return;
  const ov = document.createElement('div'); ov.id='rulesOverlay'; ov.className='rules-overlay';
  const box = document.createElement('div'); box.className='rules-box';
  const title = document.createElement('h2'); title.textContent='게임 규칙';
  const close = document.createElement('button'); close.className='rules-close'; close.textContent='닫기'; close.addEventListener('click', hideRules);
  const content = document.createElement('div'); content.className='rules-content';
  content.innerHTML = `
    <p>목표: 자신의 말(P1: 아래쪽 시작, P2: 위쪽 시작)을 상대편 끝줄까지 먼저 이동시키면 승리합니다.</p>
    <p>이동: 말은 인접한 한 칸으로 이동합니다. 상대 말을 뛰어넘을 수 있으며, 벽에 의해 차단됩니다.</p>
    <p>벽: 각 플레이어는 처음에 10개의 벽을 가집니다. 벽은 가로 또는 세로로 2칸 길이이며, 벽은 교차할 수 없습니다. 벽은 어느 쪽도 상대의 목표에 도달하지 못하게 해서는 안됩니다.</p>
    <p>조작: 말을 클릭한 뒤 이동할 칸을 클릭합니다. 벽은 방향을 선택한 뒤 슬롯에 클릭하여 놓습니다.</p>
  `;
  box.appendChild(title); box.appendChild(content); box.appendChild(close); ov.appendChild(box); document.body.appendChild(ov);
}

function showRules(){ createRulesOverlay(); document.getElementById('rulesOverlay').style.display='flex'; }
function hideRules(){ const el=document.getElementById('rulesOverlay'); if(el) el.style.display='none'; }

function init(){ state = mkState(); setupControls(); buildBoard(); render(); window.addEventListener('resize', ()=>{ buildBoard(); render(); }); }

document.addEventListener('DOMContentLoaded', ()=>{ init(); });
// detect touch capability early
if('ontouchstart' in window || navigator.maxTouchPoints > 0){ isTouch = true; }
