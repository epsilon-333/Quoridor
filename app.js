// Quoridor 9x9 — Clean single-file implementation (2 players + optional AI)
const BOARD_N = 9;
const MAX_WALLS = 10;

const boardEl = document.getElementById('board');
const turnLabel = document.getElementById('turnLabel');
const wallsLabel = document.getElementById('wallsLabel');
const newGameBtn = document.getElementById('newGameBtn');
const aiToggle = document.getElementById('aiToggle');

let state = null;
let previewEl = null;

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
  let size = boardEl.clientWidth || boardEl.getBoundingClientRect().width;
  if(!size || size < BOARD_N){
    const cs = getComputedStyle(boardEl);
    const parsed = parseFloat(cs.width);
    size = parsed || (boardEl.parentElement ? boardEl.parentElement.clientWidth : 0) || Math.max(360, BOARD_N*40);
  }
  const cell = Math.max(1, Math.floor(size/BOARD_N));
  return { cell, size };
}

function buildBoard(){
  boardEl.innerHTML = '';
  previewEl = null;
  const { cell } = computeCell();
  boardEl.style.width = `${cell*BOARD_N}px`;
  boardEl.style.height = `${cell*BOARD_N}px`;

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
      const cx = x*cell + cell;
      const cy = y*cell + cell;
      const half = Math.floor(cell/2);
      slot.style.left = `${cx-half}px`;
      slot.style.top = `${cy-half}px`;
      slot.style.width = `${cell}px`;
      slot.style.height = `${cell}px`;
      slot.style.cursor = 'pointer';
      slot.dataset.x = x; slot.dataset.y = y;
      slot.addEventListener('click', (e)=>{ e.stopPropagation(); onWallSlotClick(x,y); });
      slot.addEventListener('mouseenter', ()=>onWallSlotHover(x,y,true));
      slot.addEventListener('mouseleave', ()=>onWallSlotHover(x,y,false));
      slot.addEventListener('contextmenu', (e)=>{ e.preventDefault(); state.orient = state.orient==='h'? 'v' : 'h'; const r=document.querySelector(`input[name="orient"][value="${state.orient}"]`); if(r) r.checked=true; onWallSlotHover(x,y,true); });
      boardEl.appendChild(slot);
    }
  }
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
    if(ce){ const e = document.createElement('div'); e.className = 'pawn p'+(i+1); e.addEventListener('click',(ev)=>{ ev.stopPropagation(); onPawnClick(i); }); const prev = ce.querySelector('.pawn'); if(prev) prev.remove(); ce.appendChild(e); }
  });

  state.wallsH.forEach(k=>{ const [x,y] = k.split(',').map(Number); const w = document.createElement('div'); w.className='wall h'; w.style.left = `${x*cell}px`; w.style.top = `${(y+1)*cell - Math.floor(wallThickness/2)}px`; w.style.width = `${cell*2 + wallThickness}px`; w.style.height = `${wallThickness}px`; boardEl.appendChild(w); });
  state.wallsV.forEach(k=>{ const [x,y] = k.split(',').map(Number); const w = document.createElement('div'); w.className='wall v'; w.style.left = `${(x+1)*cell - Math.floor(wallThickness/2)}px`; w.style.top = `${y*cell}px`; w.style.width = `${wallThickness}px`; w.style.height = `${cell*2 + wallThickness}px`; boardEl.appendChild(w); });

  if(turnLabel) turnLabel.textContent = `플레이어 ${state.turn+1}`;
  if(wallsLabel) wallsLabel.textContent = `벽: P1 ${state.wallsLeft[0]} | P2 ${state.wallsLeft[1]}`;

  Array.from(boardEl.querySelectorAll('.cell.highlight')).forEach(n=>n.classList.remove('highlight','primary','secondary'));
  if(state.selected && state.selected.type==='pawn'){
    const moves = legalMoves(state.selected.player);
    moves.forEach(m=>{ const ce = boardEl.querySelector(`.cell[data-x="${m.x}"][data-y="${m.y}"]`); if(ce){ ce.classList.add('highlight'); if(state.turn===state.selected.player) ce.classList.add('primary'); else ce.classList.add('secondary'); } });
  }

  renderMoveLog();

  if(!state.gameOver && aiToggle && aiToggle.checked && state.turn===1){ setTimeout(aiMove, 220); }
}

function legalMoves(player){
  const other = 1-player; const p = state.pawns[player]; const o = state.pawns[other];
  const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]; const res = [];
  for(const d of dirs){ const nx=p.x+d.dx, ny=p.y+d.dy; if(!inBounds(nx,ny)) continue; if(isBlocked(p.x,p.y,nx,ny)) continue; if(nx===o.x && ny===o.y){ const jx=nx+d.dx, jy=ny+d.dy; if(inBounds(jx,jy) && !isBlocked(nx,ny,jx,jy)){ res.push({x:jx,y:jy}); continue; } const left={dx:-d.dy,dy:d.dx}; const right={dx:d.dy,dy:-d.dx}; const lx=nx+left.dx, ly=ny+left.dy; const rx=nx+right.dx, ry=ny+right.dy; if(inBounds(lx,ly) && !isBlocked(nx,ny,lx,ly)) res.push({x:lx,y:ly}); if(inBounds(rx,ry) && !isBlocked(nx,ny,rx,ry)) res.push({x:rx,y:ry}); } else res.push({x:nx,y:ny}); }
  return res.filter((v,i,a)=>a.findIndex(x=>x.x===v.x&&x.y===v.y)===i);
}

function isBlocked(x1,y1,x2,y2){ const dx=x2-x1, dy=y2-y1; if(Math.abs(dx)+Math.abs(dy)!==1) return true; if(dx===1){ if(wallExistsV(x1,y1)) return true; } if(dx===-1){ if(wallExistsV(x2,y2)) return true; } if(dy===1){ if(wallExistsH(x1,y1)) return true; } if(dy===-1){ if(wallExistsH(x2,y2)) return true; } return false; }

function bfsPathExists(start, targetCheck){ const q=[ start ]; const seen=new Set([coordKey(start.x,start.y)]); while(q.length){ const cur=q.shift(); if(targetCheck(cur)) return true; const dirs=[{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]; for(const d of dirs){ const nx=cur.x+d.dx, ny=cur.y+d.dy; if(!inBounds(nx,ny)) continue; if(isBlocked(cur.x,cur.y,nx,ny)) continue; const k=coordKey(nx,ny); if(seen.has(k)) continue; seen.add(k); q.push({x:nx,y:ny}); } } return false; }

function canPlaceWallH(x,y){ if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return false; if(wallExistsH(x,y) || wallExistsH(x-1,y)) return false; state.wallsH.add(coordKey(x,y)); const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1); state.wallsH.delete(coordKey(x,y)); return ok; }
function canPlaceWallV(x,y){ if(x<0||x>BOARD_N-2||y<0||y>BOARD_N-2) return false; if(wallExistsV(x,y) || wallExistsV(x,y-1)) return false; state.wallsV.add(coordKey(x,y)); const ok = bfsPathExists(state.pawns[0], p=>p.y===0) && bfsPathExists(state.pawns[1], p=>p.y===BOARD_N-1); state.wallsV.delete(coordKey(x,y)); return ok; }

function placeWallH(x,y){ state.wallsH.add(coordKey(x,y)); state.wallsLeft[state.turn]--; addMoveLog(`P${state.turn+1} 벽 H ${x},${y}`); state.turn=1-state.turn; render(); }
function placeWallV(x,y){ state.wallsV.add(coordKey(x,y)); state.wallsLeft[state.turn]--; addMoveLog(`P${state.turn+1} 벽 V ${x},${y}`); state.turn=1-state.turn; render(); }

function onPawnClick(player){ if(state.gameOver) return; if(state.turn!==player) return; state.selected={type:'pawn',player}; render(); }

function onCellClick(e){ if(state.gameOver) return; const x=Number(e.currentTarget.dataset.x), y=Number(e.currentTarget.dataset.y); if(state.selected && state.selected.type==='pawn'){ const moves=legalMoves(state.selected.player); if(moves.find(m=>m.x===x&&m.y===y)){ state.pawns[state.selected.player]={x,y}; addMoveLog(`P${state.selected.player+1} 이동 ${x},${y}`); if((state.pawns[0].y===0)||(state.pawns[1].y===BOARD_N-1)){ state.gameOver=true; } state.turn=1-state.turn; state.selected=null; render(); } } }

function onWallSlotClick(x,y){ if(state.gameOver) return; if(state.wallsLeft[state.turn]<=0) return; const orient=state.orient||'h'; if(orient==='h' && canPlaceWallH(x,y)){ placeWallH(x,y); } else if(orient==='v' && canPlaceWallV(x,y)){ placeWallV(x,y); } else if(canPlaceWallH(x,y)){ placeWallH(x,y); } else if(canPlaceWallV(x,y)){ placeWallV(x,y); } }

function onWallSlotHover(x,y,enter){ if(!enter){ if(previewEl){ previewEl.remove(); previewEl=null; } return; } if(previewEl) previewEl.remove(); const {cell}=computeCell(); const wallThickness=Math.max(8, Math.floor(cell*0.12)); const p=document.createElement('div'); p.className='wall-preview '+(state.orient==='h'?'h':'v'); if(state.orient==='h'){ p.style.left=`${x*cell}px`; p.style.top=`${(y+1)*cell - Math.floor(wallThickness/2)}px`; p.style.width=`${cell*2 + wallThickness}px`; p.style.height=`${wallThickness}px`; } else { p.style.left=`${(x+1)*cell - Math.floor(wallThickness/2)}px`; p.style.top=`${y*cell}px`; p.style.width=`${wallThickness}px`; p.style.height=`${cell*2 + wallThickness}px`; } const can=(state.orient==='h')? canPlaceWallH(x,y) : canPlaceWallV(x,y); p.style.background = can? 'rgba(0,160,0,0.35)' : 'rgba(160,0,0,0.3)'; previewEl = p; boardEl.appendChild(p); }

function nextStepTowardsGoal(player){ const start=state.pawns[player]; const target=(player===0)?0:BOARD_N-1; const q=[{x:start.x,y:start.y,prev:null}]; const seen=new Set([coordKey(start.x,start.y)]); while(q.length){ const cur=q.shift(); if(cur.y===target){ let node=cur; while(node.prev && node.prev.prev) node=node.prev; return {x:node.x,y:node.y}; } const nbs=legalMovesSimple(cur.x,cur.y); for(const nb of nbs){ const k=coordKey(nb.x,nb.y); if(seen.has(k)) continue; seen.add(k); q.push({x:nb.x,y:nb.y,prev:cur}); } } return null; }

function legalMovesSimple(x,y){ const dirs=[{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}]; const res=[]; for(const d of dirs){ const nx=x+d.dx, ny=y+d.dy; if(!inBounds(nx,ny)) continue; if(!isBlocked(x,y,nx,ny)) res.push({x:nx,y:ny}); } return res; }

function aiMove(){ if(state.gameOver) return; const me=1; const step=nextStepTowardsGoal(me); if(step){ state.pawns[me]=step; addMoveLog(`AI 이동 ${step.x},${step.y}`); state.turn=0; render(); } }

function setupControls(){ if(newGameBtn) newGameBtn.addEventListener('click', ()=>{ state=mkState(); render(); }); const orEls=document.querySelectorAll('input[name="orient"]'); orEls.forEach(r=>r.addEventListener('change',(e)=>{ if(e.target.checked) state.orient=e.target.value; })); const r=document.querySelector(`input[name="orient"][value="${state?state.orient:'h'}"]`); if(r) r.checked=true; }

function init(){ state = mkState(); setupControls(); buildBoard(); render(); window.addEventListener('resize', ()=>{ buildBoard(); render(); }); }

document.addEventListener('DOMContentLoaded', ()=>{ init(); });

function coordToAlg(x,y){
  return `${String.fromCharCode(97+x)}${y+1}`;
}

function shortestPathLength(player){
  const start = state.pawns[player]; const targetRow = player===0?0:BOARD_N-1;
  const q=[{x:start.x,y:start.y,d:0}]; const seen = new Set([coordKey(start.x,start.y)]);
  while(q.length){ const cur = q.shift(); if(cur.y===targetRow) return cur.d; const nbs = legalMovesSimple(cur.x,cur.y); for(const nb of nbs){ const k = coordKey(nb.x,nb.y); if(seen.has(k)) continue; seen.add(k); q.push({x:nb.x,y:nb.y,d:cur.d+1}); }} return null;
}

function pathExistsForBoth(){ return shortestPathLength(0) !== null && shortestPathLength(1) !== null; }
function checkWin(player){ if(player===0) return state.pawns[0].y===0; return state.pawns[1].y===BOARD_N-1; }

function setupOrientControls(){
  const inputs = document.querySelectorAll('input[name="orient"]');
  inputs.forEach(i=>i.addEventListener('change', ()=>{ if(i.checked) state.orient = i.value; }));
  const r = document.querySelector(`input[name="orient"][value="${state.orient}"]`);
  if(r) r.checked = true;
}

newGameBtn.addEventListener('click', ()=>{ state = mkState(); buildBoard(); setupOrientControls(); render(); });
window.addEventListener('resize', ()=>{ buildBoard(); render(); });

// setup initial
state = mkState();
buildBoard();
setupOrientControls();
render();

// keyboard shortcut: 'r' to toggle orientation
window.addEventListener('keydown', (e)=>{
  if(e.key.toLowerCase()==='r'){
    state.orient = state.orient === 'h' ? 'v' : 'h';
    const r = document.querySelector(`input[name="orient"][value="${state.orient}"]`);
    if(r) r.checked = true;
  }
});
