import {SAVE_KEY,freshState,decodeSave,canSlide,slide,isSolved,formatTime} from './core.js';
const $=id=>document.getElementById(id);
let state=freshState(),startedAt=null,storageBlocked=false,preserveUnreadable=false,saveFailed=false,notice='',newBest=false,dialogContext=null,previousFocus=null;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){try{state=decodeSave(raw);}catch(error){if(error.message==='Newer save'){storageBlocked=true;notice='This save is from a newer version. It has been left untouched. This game won’t be saved.';}else{preserveUnreadable=true;notice='Your saved game couldn’t be restored. A fresh puzzle is ready. Your next move or new puzzle will replace the unreadable save.';}}}}
catch{storageBlocked=true;notice='This browser couldn’t open local storage. You can play, but this game won’t be saved.';}
const elapsed=()=>state.elapsedMs+(startedAt===null?0:Math.max(0,performance.now()-startedAt));
function snapshot(){return {...state,board:[...state.board],initial:[...state.initial],elapsedMs:Math.floor(elapsed()),records:JSON.parse(JSON.stringify(state.records))};}
function storageUI(){ $('storage-notice').hidden=!notice&&!saveFailed;$('storage-notice').textContent=notice||(saveFailed?'Your browser couldn’t save this game. Keep this page open; saving will be tried again as you play.':'');$('save-status').textContent=storageBlocked||preserveUnreadable?'Playing without saving':saveFailed?'Not saved · keep this page open':'Saved on this device';}
function save(){if(!storageBlocked&&!preserveUnreadable){try{localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()));saveFailed=false;notice='';}catch{saveFailed=true;}}storageUI();}
function stopClock(){state.elapsedMs=Math.floor(elapsed());startedAt=null;}
function startClock(){state.phase='playing';startedAt=performance.now();}
function pause(){if(state.phase!=='playing')return;stopClock();state.phase='paused';save();render();}
function resume(){if(state.phase!=='paused'||dialogContext)return;startClock();save();render();$('board').focus({preventScroll:true});}
function announce(message){$('announcement').textContent=message;}
function move(index){
  if(dialogContext||!['ready','playing'].includes(state.phase))return false;
  const next=slide(state.board,state.n,index);if(!next)return false;
  if(state.phase==='ready')startClock();state.board=next;state.moves++;preserveUnreadable=false;
  if(isSolved(next)){
    stopClock();state.phase='solved';state.completed++;
    const best=state.records[state.n];newBest=!best||state.moves<best.moves||(state.moves===best.moves&&state.elapsedMs<best.elapsedMs);
    if(newBest)state.records[state.n]={moves:state.moves,elapsedMs:state.elapsedMs};
    announce(`Puzzle solved in ${state.moves} moves and ${formatTime(state.elapsedMs)}.${newBest?' New personal best!':''}`);
  }
  save();render();if(state.phase==='solved')$('play-again').focus({preventScroll:true});return true;
}
function reset(kind,n){
  startedAt=null;newBest=false;preserveUnreadable=false;
  state=kind==='restart'?{...state,board:[...state.initial],moves:0,elapsedMs:0,phase:'ready'}:freshState(n??state.n,state.records,state.completed);
  save();render();announce(kind==='restart'?'The same puzzle is ready to try again.':`New ${state.n} by ${state.n} puzzle ready.`);
}
function requestReset(kind,n){
  if(dialogContext)return;
  if(state.moves>0&&state.phase!=='solved'){
    previousFocus=document.activeElement;const wasPlaying=state.phase==='playing';pause();dialogContext={kind,n,wasPlaying};
    $('confirm-title').textContent=kind==='restart'?'Try this puzzle again?':'Start a fresh puzzle?';
    $('confirm-copy').textContent=kind==='restart'?'The same tiles will return to their starting positions. Your moves and timer will reset.':'Your current puzzle will be replaced. Your moves and timer will reset.';
    $('confirm-change').textContent=kind==='restart'?'Restart':'New puzzle';$('confirm-dialog').returnValue='';$('confirm-dialog').showModal();$('cancel-change').focus();
  }else reset(kind,n);
}
function endDialog(accepted){
  const context=dialogContext;if(!context)return;dialogContext=null;
  if(accepted)reset(context.kind,context.n);else if(context.wasPlaying&&!document.hidden)resume();
  if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;
}
let tileNodes=[],nodeSize=0;
function render(){
  const {n,board,phase}=state,locked=phase==='paused'||phase==='solved';
  $('moves').textContent=state.moves;$('time').textContent=formatTime(elapsed());
  document.querySelectorAll('[data-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.size)===n)));
  $('board').setAttribute('aria-label',`${n} by ${n} sliding puzzle`);$('tiles').style.setProperty('--n',n);$('tiles').inert=locked;
  if(nodeSize!==n){
    $('tiles').replaceChildren();tileNodes=[];nodeSize=n;
    for(let value=0;value<n*n;value++){
      const tile=document.createElement(value?'button':'div');tile.className=value?'tile':'tile gap';tile.dataset.value=value;
      if(value){tile.textContent=value;tile.dataset.row=Math.floor((value-1)/n);tile.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;move(state.board.indexOf(value));});}
      else tile.setAttribute('aria-hidden','true');
      tileNodes[value]=tile;$('tiles').append(tile);
    }
  }
  board.forEach((value,i)=>{
    const tile=tileNodes[value],movable=canSlide(board,n,i),correct=value!==0&&value===i+1;
    tile.style.setProperty('--x',i%n);tile.style.setProperty('--y',Math.floor(i/n));
    if(value){tile.classList.toggle('movable',movable&&!locked);tile.classList.toggle('correct',correct);tile.setAttribute('aria-label',`Tile ${value}, row ${Math.floor(i/n)+1}, column ${i%n+1}${correct?', in place':''}${movable?', can slide':''}`);tile.disabled=locked;tile.tabIndex=movable&&!locked?0:-1;}
  });
  const correct=board.filter((v,i)=>v!==0&&v===i+1).length,total=n*n-1;
  $('progress-label').textContent=`${correct} of ${total} in place`;$('progress').style.width=`${correct/total*100}%`;
  $('phase-label').textContent={ready:'Ready when you are',playing:'One move at a time',paused:'Take your time',solved:'Puzzle complete'}[phase];
  $('pause').disabled=phase==='ready'||phase==='solved';$('pause-icon').textContent=phase==='paused'?'▷':'Ⅱ';$('pause').setAttribute('aria-label',phase==='paused'?'Resume game':'Pause game');
  $('pause-overlay').hidden=phase!=='paused';$('win-overlay').hidden=phase!=='solved';
  $('win-summary').textContent=`${state.moves} moves · ${formatTime(state.elapsedMs)}`;$('new-best').hidden=!newBest;
  $('best-size').textContent=`${n} × ${n} puzzle`;
  const best=state.records[n],values=$('best-values');values.replaceChildren();
  if(best){for(const [value,label]of [[best.moves,'moves'],[formatTime(best.elapsedMs),'time']]){const block=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=value;small.textContent=label;block.append(strong,small);values.append(block);}}
  else{const empty=document.createElement('span');empty.className='best-empty';empty.textContent='Your first finish starts the story.';values.append(empty);}
  storageUI();
}
$('pause').addEventListener('click',()=>state.phase==='paused'?resume():pause());$('resume').addEventListener('click',resume);
$('restart').addEventListener('click',()=>requestReset('restart'));$('new-game').addEventListener('click',()=>requestReset('new'));$('play-again').addEventListener('click',()=>requestReset('new'));
document.querySelectorAll('[data-size]').forEach(button=>button.addEventListener('click',()=>{const n=Number(button.dataset.size);if(n!==state.n)requestReset('new',n);}));
$('cancel-change').addEventListener('click',()=>$('confirm-dialog').close('cancel'));$('confirm-change').addEventListener('click',()=>$('confirm-dialog').close('confirm'));
$('confirm-dialog').addEventListener('close',()=>endDialog($('confirm-dialog').returnValue==='confirm'));
$('help').addEventListener('click',()=>{if(dialogContext)return;previousFocus=document.activeElement;const wasPlaying=state.phase==='playing';pause();dialogContext={kind:'help',wasPlaying};$('help-dialog').showModal();});
$('close-help').addEventListener('click',()=>$('help-dialog').close());$('help-dialog').addEventListener('close',()=>endDialog(false));
$('board').addEventListener('keydown',event=>{
  if(event.key===' '){event.preventDefault();state.phase==='paused'?resume():pause();return;}
  const directions={ArrowUp:-state.n,ArrowDown:state.n,ArrowLeft:-1,ArrowRight:1};if(!(event.key in directions))return;
  event.preventDefault();const gap=state.board.indexOf(0);move(gap+directions[event.key]);
});
let pointer=null,suppressClickUntil=0;
$('tiles').addEventListener('pointerdown',event=>{const tile=event.target.closest('[data-value]');if(tile&&Number(tile.dataset.value)>0)pointer={x:event.clientX,y:event.clientY,value:Number(tile.dataset.value),id:event.pointerId};});
$('tiles').addEventListener('pointerup',event=>{
  if(!pointer||event.pointerId!==pointer.id)return;const {x,y,value}=pointer;pointer=null;
  const dx=event.clientX-x,dy=event.clientY-y;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;
  suppressClickUntil=performance.now()+400;
  const i=state.board.indexOf(value),gap=state.board.indexOf(0);if(!canSlide(state.board,state.n,i))return;
  const horizontal=Math.abs(dx)>Math.abs(dy),target=horizontal?(dx>0?i+1:i-1):(dy>0?i+state.n:i-state.n);
  if(target===gap)move(i);
});
$('tiles').addEventListener('pointercancel',()=>pointer=null);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();save();}});window.addEventListener('pagehide',()=>{pause();save();});
let ticks=0;setInterval(()=>{if(state.phase==='playing'){$('time').textContent=formatTime(elapsed());if(++ticks%20===0)save();}},250);
render();save();
const context=document.modelContext;
if(context?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const read=()=>({size:state.n,tiles:[...state.board],phase:state.phase,moves:state.moves,elapsedMs:Math.floor(elapsed())});
  for(const tool of [
    {name:'read_puzzle',title:'Read puzzle',description:'Read the current number-slide puzzle and play state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>read()},
    {name:'slide_tile',title:'Slide a tile',description:'Slide a numbered tile adjacent to the empty square. The puzzle must be ready or playing; this makes one move.',inputSchema:{type:'object',properties:{tile:{type:'integer',minimum:1,maximum:24}},required:['tile'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='tile')||!Number.isInteger(input.tile)||input.tile<1||input.tile>=state.n*state.n)throw new Error('Choose a tile number on this board.');if(!move(state.board.indexOf(input.tile)))throw new Error('This tile cannot move, or the game is paused.');return read();}}
  ]){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
}
