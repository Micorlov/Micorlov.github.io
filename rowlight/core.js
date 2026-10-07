export const SAVE_KEY = 'rowlight.web.v1';
export const solvedBoard = n => Array.from({length:n*n}, (_,i)=>(i+1)%(n*n));
export const isSolved = board => board.every((v,i)=>v===(i+1)%board.length);
export function canSlide(board,n,i){
  if(!Number.isInteger(i)||i<0||i>=board.length||board[i]===0)return false;
  const gap=board.indexOf(0);
  return Math.abs(Math.floor(i/n)-Math.floor(gap/n))+Math.abs(i%n-gap%n)===1;
}
export function slide(board,n,i){if(!canSlide(board,n,i))return null;const next=[...board],gap=next.indexOf(0);[next[i],next[gap]]=[next[gap],next[i]];return next;}
export function isSolvable(board,n){
  const a=board.filter(Boolean);let inversions=0;
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])inversions++;
  return n%2 ? inversions%2===0 : (inversions+n-Math.floor(board.indexOf(0)/n))%2===1;
}
export function shuffle(n,random=Math.random){
  if(![3,4,5].includes(n))throw new Error('Choose a 3, 4, or 5 tile board.');
  let board=solvedBoard(n),previous=-1;
  for(let step=0;step<n*n*80;step++){
    const choices=board.map((_,i)=>i).filter(i=>canSlide(board,n,i)&&i!==previous);
    previous=board.indexOf(0);board=slide(board,n,choices[Math.floor(random()*choices.length)]);
  }
  return isSolved(board)?slide(board,n,board.length-2):board;
}
export function freshState(n=4,records={},completed=0){const board=shuffle(n);return {version:1,n,board,initial:[...board],moves:0,elapsedMs:0,phase:'ready',records,completed};}
export function validBoard(board,n){return Array.isArray(board)&&board.length===n*n&&new Set(board).size===n*n&&board.every(v=>Number.isInteger(v)&&v>=0&&v<n*n)&&isSolvable(board,n);}
const whole=n=>Number.isSafeInteger(n)&&n>=0;
export function decodeSave(raw){
  const s=JSON.parse(raw);
  if(!s||typeof s!=='object')throw new Error('Invalid save');
  if(Number.isInteger(s.version)&&s.version>1)throw new Error('Newer save');
  if(s.version!==1||![3,4,5].includes(s.n)||!validBoard(s.board,s.n)||!validBoard(s.initial,s.n)||isSolved(s.initial)||!whole(s.moves)||!whole(s.elapsedMs)||!whole(s.completed)||!['ready','playing','paused','solved'].includes(s.phase)||!s.records||typeof s.records!=='object'||Array.isArray(s.records))throw new Error('Invalid save');
  if((s.phase==='solved')!==isSolved(s.board)||(s.phase==='ready'&&(s.moves!==0||s.elapsedMs!==0||s.board.some((v,i)=>v!==s.initial[i])))||(s.phase!=='ready'&&s.moves<1))throw new Error('Invalid save');
  const records={};
  for(const [n,r]of Object.entries(s.records)){if(!['3','4','5'].includes(n)||!r||!whole(r.moves)||r.moves<1||!whole(r.elapsedMs))throw new Error('Invalid save');records[n]={moves:r.moves,elapsedMs:r.elapsedMs};}
  return {version:1,n:s.n,board:[...s.board],initial:[...s.initial],moves:s.moves,elapsedMs:s.elapsedMs,phase:s.phase==='playing'?'paused':s.phase,records,completed:s.completed};
}
export function formatTime(ms){const total=Math.floor(ms/1000),sec=String(total%60).padStart(2,'0'),min=String(Math.floor(total/60)%60).padStart(2,'0');return total>=3600?`${Math.floor(total/3600)}:${min}:${sec}`:`${min}:${sec}`;}
