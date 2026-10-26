/* MARIE SPIDER ARCADE — standalone DOM game, fully offline. */
(() => {
  'use strict';
  const Core=window.SpiderCore;
  if(!Core) {document.body.textContent='게임 규칙 엔진을 읽지 못했습니다. 압축을 풀고 index.html을 실행해주세요.';return;}
  const $=id=>document.getElementById(id);
  const STORAGE='marie-spider-arcade-v12';
  const SUITS={S:'♠',H:'♥',D:'♦',C:'♣'};
  const BOSSES=[
    {name:'망각의 실거미',asset:'queen.webp',taunt:'“너의 패는 이미 거미줄에 걸려 있다.”'},
    {name:'암흑의 파수꾼',asset:'reaper.webp',taunt:'“검은 성벽은 누구에게도 길을 내주지 않는다.”'},
    {name:'진홍의 거미 여왕',asset:'queen.webp',taunt:'“두 번째 기회는 없어. 계속 움직여 보렴.”'},
    {name:'심연의 드래곤',asset:'dragon.webp',taunt:'“마지막 여덟 개의 봉인을 풀어 보아라!”'}
  ];
  let game=null,history=[],selected=null,pointer=null,ghost=null,suppressClickUntil=0;
  let soundOn=false,audioCtx=null,toastTimer=null,lastTick=Date.now(),saveTick=0;
  let lastDealtIds=new Set(),hintTimer=null,hitTimer=null,showingVictory=false;
  const board=$('board'),modal=$('modal'),modalActions=$('modal-actions');

  const safeStorage={
    get(key){try{return localStorage.getItem(key);}catch{return null;}},
    set(key,val){try{localStorage.setItem(key,val);}catch{/* file:// policy may block storage */}}
  };
  function save(){if(!game)return;safeStorage.set(STORAGE,JSON.stringify({game,history:history.slice(-80)}));}
  function load(){try{
    const data=JSON.parse(safeStorage.get(STORAGE)||'null');
    if(!data||!Core.validate(data.game))return false;
    game=data.game;game.paused=false;history=(data.history||[]).filter(Core.validate).slice(-80);
    $('difficulty').value=String(game.difficulty);lastTick=Date.now();return true;
  }catch{return false;}}
  function pushUndo(){history.push(Core.deepCopy(game));if(history.length>150)history.shift();}
  function bestKey(){return 'marie-spider-best-'+game.difficulty;}
  function formatTime(s){s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
  function announce(txt,ms=2400){$('status').textContent=txt;toast(txt,ms);}
  function toast(txt,ms=2200){const node=$('toast');node.textContent=txt;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),ms);}
  function play(type='click'){
    if(!soundOn)return;
    try{
      if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      const tones={click:[480,.045,'sine'],move:[690,.07,'triangle'],deal:[260,.13,'triangle'],
        win:[830,.45,'sine'],hit:[170,.23,'sawtooth'],error:[150,.08,'square'],skill:[470,.55,'sawtooth'],reveal:[945,.1,'sine']};
      const [hz,len,wave]=tones[type]||tones.click;
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type=wave;osc.frequency.setValueAtTime(hz,audioCtx.currentTime);
      if(type==='skill')osc.frequency.exponentialRampToValueAtTime(90,audioCtx.currentTime+len);
      gain.gain.setValueAtTime(.0001,audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.065,audioCtx.currentTime+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+len);
      osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+len+.01);
    }catch{/* audio is optional */}
  }

  const FACE_ROLE={11:'jack',12:'queen',13:'king'};
  const PIP_LAYOUTS={
    1:[[50,50,false]],
    2:[[50,24,false],[50,76,true]],
    3:[[50,22,false],[50,50,false],[50,78,true]],
    4:[[32,25,false],[68,25,false],[32,75,true],[68,75,true]],
    5:[[32,25,false],[68,25,false],[50,50,false],[32,75,true],[68,75,true]],
    6:[[32,22,false],[68,22,false],[32,50,false],[68,50,false],[32,78,true],[68,78,true]],
    7:[[32,20,false],[68,20,false],[50,36,false],[32,50,false],[68,50,false],[32,80,true],[68,80,true]],
    8:[[32,18,false],[68,18,false],[32,39,false],[68,39,false],[32,61,true],[68,61,true],[32,82,true],[68,82,true]],
    9:[[32,18,false],[68,18,false],[32,36,false],[68,36,false],[50,50,false],[32,64,true],[68,64,true],[32,82,true],[68,82,true]],
    10:[[32,16,false],[68,16,false],[32,33,false],[68,33,false],[32,50,false],[68,50,false],[32,67,true],[68,67,true],[32,84,true],[68,84,true]]
  };
  function rankLabel(rank){return rank===1?'A':rank===11?'J':rank===12?'Q':rank===13?'K':String(rank);}
  function cardAria(card){return `${SUITS[card.suit]} ${rankLabel(card.rank)}`;}
  function pipMarkup(card){
    return (PIP_LAYOUTS[card.rank]||[]).map(([x,y,flip])=>`<span class="pip pip-${card.suit}${flip?' flip':''}" style="left:${x}%;top:${y}%">${SUITS[card.suit]}</span>`).join('');
  }
  function frontMarkup(card){
    const rank=rankLabel(card.rank);
    const center=card.rank>=11
      ? `<div class="face-field ${FACE_ROLE[card.rank]}"><span class="face-aura">${SUITS[card.suit]}</span><span class="face-sprite ${FACE_ROLE[card.rank]}"></span><span class="face-badge">${FACE_ROLE[card.rank].toUpperCase()}</span></div>`
      : `<div class="pip-field">${pipMarkup(card)}${card.suit==='H'?'<span class="heart-core" aria-hidden="true"></span>':`<span class="suit-core ${card.suit}" aria-hidden="true">${SUITS[card.suit]}</span>`}</div>`;
    return `<div class="card-surface suit-${card.suit} ${card.rank>=11?'face-card':'number-card'} rank-${card.rank}"><div class="card-sheen"></div><div class="corner tl"><span class="rank">${rank}</span><span class="symbol">${SUITS[card.suit]}</span></div><div class="corner br"><span class="rank">${rank}</span><span class="symbol">${SUITS[card.suit]}</span></div><div class="card-center">${center}</div></div>`;
  }
  function render(){
    if(!game)return;
    const html=game.columns.map((column,col)=>{
      let top=0;
      const cards=column.map((card,i)=>{
        const css=['card',`suit-${card.suit}`];
        if(card.faceUp)css.push('face-up'); else css.push('face-down');
        if(selected&&selected.col===col&&i>=selected.index)css.push('selected');
        if(lastDealtIds.has(card.id))css.push('just-dealt');
        const aria=card.faceUp?cardAria(card):'뒷면';
        const inner=card.faceUp?frontMarkup(card):`<img class="card-back" src="assets/card-back.webp" alt="" draggable="false">`;
        const line=`<div class="${css.join(' ')}" data-col="${col}" data-index="${i}" data-id="${card.id}" style="top:${top}px;z-index:${i+1}" role="button" tabindex="0" aria-label="${col+1}열 카드 ${aria}" aria-pressed="${Boolean(selected&&selected.col===col&&selected.index===i)}">${inner}</div>`;
        top+=card.faceUp?29:18;return line;
      }).join('');
      const height=Math.max(575,top+220);
      return `<div class="column" data-col="${col}" data-number="${String(col+1).padStart(2,'0')}" aria-label="${col+1}열, 카드 ${column.length}장" style="min-height:${height}px">${cards}</div>`;
    }).join('');
    board.innerHTML=html;lastDealtIds.clear();updateHUD();
  }
  function updateHUD(){
    if(!game)return;
    $('score').textContent=game.score.toLocaleString('ko-KR');
    $('moves').textContent=game.moves;
    $('time').textContent=formatTime(game.elapsed);
    $('combo').textContent='×'+game.combo;
    $('cleared').textContent=`완성 ${game.completed} / 8`;
    $('progress-fill').style.width=(game.completed/8*100)+'%';
    const remain=game.stock.length/10;
    $('stock-count').textContent=`${remain}회 남음 · ${game.stock.length}장`;
    $('stock').disabled=remain===0 || game.paused || game.completed===8;
    $('stock').title=(remain>0&&game.columns.some(c=>!c.length))?'빈 열을 채워야 새 카드를 배분할 수 있습니다.':'10열에 카드를 한 장씩 배분';
    $('undo').disabled=history.length===0 || game.paused;
    $('hint').disabled=game.paused||game.completed===8;
    $('skill').disabled=game.energy<100||game.paused||game.completed===8;
    $('skill').classList.toggle('ready',game.energy>=100&&!game.paused);
    $('energy-fill').style.width=game.energy+'%';
    $('energy-label').textContent=`마력 ${game.energy} / 100`;
    const stage=Core.getStage(game),boss=BOSSES[stage-1],shield=Core.stageShield(game);
    $('stage-number').textContent=`STAGE ${String(stage).padStart(2,'0')} / 04`;
    $('boss-name').textContent=boss.name;
    $('boss-taunt').textContent=boss.taunt;
    $('boss-art').src='assets/'+boss.asset;
    $('boss-fill').style.width=shield+'%';
    $('shield-value').textContent=`보호막 ${shield}%`;
    const sets=Math.min(2,game.completed-(stage-1)*2);
    $('quests').innerHTML=`<div>◈ 현재 스테이지 봉인: <b>${sets} / 2</b></div><div>◈ 전체 완성 세트: <b>${game.completed} / 8</b></div><div>⚡ 마력 충전: <b>${game.energy} / 100</b></div><div>✧ 카드 더미: <b>${remain} / 5회</b></div>`;
    const best=safeStorage.get(bestKey());$('best-label').textContent=`${game.difficulty}무늬 최고 점수 ${best||'—'}`;
  }
  function createNewGame(level=Number($('difficulty').value)){
    game=Core.createGame(level);history=[];selected=null;lastDealtIds.clear();showingVictory=false;
    $('difficulty').value=String(level);board.classList.remove('locked');
    $('pause-overlay').hidden=true;$('pause-text').textContent='일시정지';$('pause-icon').textContent='Ⅱ';
    announce('새 작전 시작! 같은 무늬 K부터 A까지 정렬하세요.',1900);render();save();lastTick=Date.now();play('deal');
  }
  function closeModal(){modal.hidden=true;modalActions.replaceChildren();}
  function showModal(title,msg,buttons){$('modal-title').textContent=title;$('modal-message').textContent=msg;modalActions.replaceChildren();
    for(const b of buttons){const el=document.createElement('button');el.className='btn '+(b.main?'btn-main':'');el.textContent=b.text;el.addEventListener('click',()=>{closeModal();b.action?.();},{once:true});modalActions.append(el);}
    modal.hidden=false;
  }
  function requestNewGame(level=Number($('difficulty').value)){
    if(game&&game.moves>0&&game.completed<8){
      showModal('정말 새로 시작할까요?','현재 플레이 진행 상태가 초기화됩니다.\n새 게임을 시작하면 이전 판으로 돌아갈 수 없습니다.',[
        {text:'계속 플레이',action:()=>{$('difficulty').value=String(game.difficulty);}},
        {text:'새 작전 시작',main:true,action:()=>createNewGame(level)}
      ]);
    }else createNewGame(level);
  }
  function maybeVictory(){
    if(game.completed<8||showingVictory)return false;
    showingVictory=true;board.classList.add('locked');play('win');burstAt(window.innerWidth*.5,window.innerHeight*.35,'#ffd27c',95);
    const saved=Number(safeStorage.get(bestKey())||0),record=game.score>saved;
    if(record){safeStorage.set(bestKey(),String(game.score));updateHUD();}
    setTimeout(()=>showModal('✦ 거미의 성채 해방! ✦',
      `104장의 카드 중 모든 K→A 세트를 완성했습니다.\n점수: ${game.score.toLocaleString()} · 시간: ${formatTime(game.elapsed)} · 이동: ${game.moves}${record?'\n신기록 달성!':''}`,
      [{text:'전장 다시 보기',action:()=>{}},{text:'새 게임',main:true,action:()=>createNewGame()}]),900);
    return true;
  }
  function afterChange(result,kind,oldStage){
    selected=null;
    render();save();
    if(kind==='move'){
      play(result.revealed?'reveal':'move');
      if(result.revealed)toast('✧ 새로운 카드 공개 · 마력 추가 충전!');
      else if(game.combo>=3)toast(`⚔ ${game.combo} COMBO · 연속 이동 보너스!`,1400);
    }
    if(kind==='deal')play('deal');
    const clears=result.clears||[];
    if(clears.length){
      const oldCount=game.completed-clears.length;
      flashClears(clears);
      announce(`⚔ ${clears.length}개 세트 완성! 거미 봉인 파괴 · +${clears.length*100}점`,2700);
      const boss=$('boss-art').getBoundingClientRect();
      bossHit(boss.left+boss.width/2,boss.top+boss.height/2,'SEAL BREAK!');
      for(let i=0;i<clears.length;i++)setTimeout(()=>burstAt(window.innerWidth*.5,window.innerHeight*.45,'#f8bc74',38),i*150);
      if(Core.getStage(game)!==oldStage && oldCount<8){setTimeout(()=>announce(`★ 스테이지 ${Core.getStage(game)} 돌입 · ${BOSSES[Core.getStage(game)-1].name} 출현!`,2900),650);}
    }else if(kind==='deal')announce(`새 카드 10장을 배분했습니다. 남은 배분: ${game.stock.length/10}회`);
    maybeVictory();
    if(!showingVictory&&game.stock.length===0&&Core.findMoves(game).length===0){
      setTimeout(()=>showModal('막다른 길','더 이상 가능한 카드 이동도, 남은 배분 카드도 없습니다.\n되돌리기로 다른 수를 시도하거나 새 게임을 시작할 수 있습니다.',[
        {text:'되돌리기',main:true,action:undo},{text:'새 게임',action:()=>createNewGame()}]),450);
    }
  }
  function tryMove(from,index,to){
    if(game.paused||game.completed===8)return false;
    const result=Core.applyMove(game,from,index,to);
    if(!result){play('error');return false;}
    pushUndo();const stage=Core.getStage(game);game=result.game;afterChange(result,'move',stage);
    return true;
  }
  function dealCards(){
    if(game.paused)return;
    if(game.stock.length<10){toast('더 이상 배분할 카드가 없습니다.');play('error');return;}
    if(game.columns.some(c=>c.length===0)){
      toast('빈 열을 먼저 채워야 10장의 카드를 배분할 수 있습니다.',3200);play('error');return;
    }
    const result=Core.deal(game);if(!result)return;
    pushUndo();const stage=Core.getStage(game);game=result.game;
    lastDealtIds=new Set(game.columns.map(c=>c[c.length-1]?.id));
    afterChange(result,'deal',stage);
  }
  function undo(){if(!history.length||game.paused){toast('되돌릴 카드 이동이 없습니다.');return;}
    game=history.pop();selected=null;showingVictory=false;board.classList.remove('locked');
    render();save();toast('마지막 행동을 되돌렸습니다.');play('click');
  }
  function hint(){
    if(game.paused)return;
    const all=Core.findMoves(game);
    if(!all.length){
      toast(game.stock.length? '가능한 이동이 없습니다. 남은 카드를 배분해 보세요.':'가능한 이동이 없습니다. 실행 취소를 이용하세요.',3400);return;
    }
    // avoid recommending meaningless empty-column shuffles if a more productive move exists
    const pick=all[0];clearTimeout(hintTimer);
    document.querySelectorAll('.hint-source,.hint-target').forEach(el=>el.classList.remove('hint-source','hint-target'));
    const src=board.querySelector(`.card[data-col="${pick.from}"][data-index="${pick.index}"]`);
    const target=board.querySelector(`.column[data-col="${pick.to}"]`);
    if(src)src.classList.add('hint-source');if(target)target.classList.add('hint-target');
    hintTimer=setTimeout(()=>{src?.classList.remove('hint-source');target?.classList.remove('hint-target');},2500);
    toast(`${pick.from+1}열의 ${pick.index+1}번째 카드 묶음 → ${pick.to+1}열로 이동`,2500);play('click');
  }
  function useSkill(){
    const next=Core.useSkill(game);if(!next||game.paused)return;
    pushUndo();game=next;render();save();
    const b=$('boss-art').getBoundingClientRect();bossHit(b.left+b.width/2,b.top+b.height/2,'ARCANE STRIKE!');
    announce('⚡ 아케인 스트라이크! 보스 보호막 타격 · +30점. 카드 배열은 그대로입니다.');play('skill');
  }
  function pauseGame(force){
    const desired=typeof force==='boolean'?force:!game.paused;
    game.paused=desired;selected=null;board.classList.toggle('locked',desired);
    $('pause-overlay').hidden=!desired;$('pause-text').textContent=desired?'계속하기':'일시정지';
    $('pause-icon').textContent=desired?'▶':'Ⅱ';lastTick=Date.now();render();save();
  }
  function selectCard(col,index){
    if(game.paused)return;
    if(Core.isMovableSequence(game.columns[col],index)){
      selected={col,index};render();play('click');
      const card=game.columns[col][index];toast(`${SUITS[card.suit]} ${card.rank} 카드 묶음 선택 · 이동할 열을 클릭하세요.`,1700);
    }else{selected=null;render();toast('여러 장은 동일 무늬의 연속된 내림차순으로만 이동할 수 있습니다.',1700);}
  }
  // Mouse/keyboard click-to-move and touch-friendly tap-to-move.
  board.addEventListener('click',e=>{
    if(Date.now()<suppressClickUntil||game.paused||!modal.hidden)return;
    const target=e.target.closest('.card'),colNode=e.target.closest('.column');
    if(!colNode)return;
    const col=Number(colNode.dataset.col),idx=target?Number(target.dataset.index):-1;
    if(selected&&selected.col!==col){
      if(tryMove(selected.col,selected.index,col))return;
      toast('옮길 카드보다 숫자가 정확히 1 높은 카드 위에 놓으세요.',1700);
      if(target&&Core.isMovableSequence(game.columns[col],idx)){selectCard(col,idx);return;}
    }
    if(target){
      if(selected&&selected.col===col&&selected.index===idx){selected=null;render();return;}
      selectCard(col,idx);
    }else if(!selected){toast('이동할 카드 묶음을 먼저 선택하세요.',1300);}
  });
  board.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){const card=e.target.closest('.card');if(!card)return;e.preventDefault();card.click();}
  });
  function buildGhost(cards,width,from,index){
    ghost=document.createElement('div');ghost.className='drag-ghost';ghost.style.width=width+'px';
    for(let i=0;i<cards.length;i++){
      const src=board.querySelector(`.card[data-col="${from}"][data-index="${index+i}"]`);
      const clone=(src?src.cloneNode(true):document.createElement('div'));
      clone.classList.remove('selected','hint-source','drag-source');
      clone.removeAttribute('tabindex');clone.removeAttribute('aria-label');clone.removeAttribute('aria-pressed');
      clone.style.top=i*28+'px';clone.style.left='0';clone.style.zIndex=i+1;ghost.append(clone);
    }
    document.body.append(ghost);
  }
  function ghostPosition(x,y){if(ghost){ghost.style.left=(x+14)+'px';ghost.style.top=(y+14)+'px';}}
  function resetDrag(){
    document.querySelectorAll('.drag-source,.drop-ok').forEach(el=>el.classList.remove('drag-source','drop-ok'));
    ghost?.remove();ghost=null;pointer=null;
  }
  board.addEventListener('pointerdown',e=>{
    if(e.button!==0||game.paused||!modal.hidden)return;
    const card=e.target.closest('.card');if(!card)return;
    const from=Number(card.dataset.col),index=Number(card.dataset.index);
    if(!Core.isMovableSequence(game.columns[from],index))return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY,from,index,active:false};
    try{card.setPointerCapture(e.pointerId);}catch{}
  });
  board.addEventListener('pointermove',e=>{
    if(!pointer||e.pointerId!==pointer.id)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if(!pointer.active&&Math.hypot(dx,dy)>8){
      pointer.active=true;
      const cards=game.columns[pointer.from].slice(pointer.index);
      const fromEl=board.querySelector(`.card[data-col="${pointer.from}"][data-index="${pointer.index}"]`);
      buildGhost(cards,Math.round(fromEl?.getBoundingClientRect().width||100),pointer.from,pointer.index);
      board.querySelectorAll(`.card[data-col="${pointer.from}"]`).forEach(el=>{
        if(Number(el.dataset.index)>=pointer.index)el.classList.add('drag-source');
      });
    }
    if(pointer.active){e.preventDefault();ghostPosition(e.clientX,e.clientY);
      const item=document.elementFromPoint(e.clientX,e.clientY)?.closest('.column');
      document.querySelectorAll('.drop-ok').forEach(el=>el.classList.remove('drop-ok'));
      if(item&&Core.isValidMove(game,pointer.from,pointer.index,Number(item.dataset.col)))item.classList.add('drop-ok');
    }
  },{passive:false});
  function finishPointer(e){
    if(!pointer||e.pointerId!==pointer.id)return;
    if(pointer.active){
      suppressClickUntil=Date.now()+330;
      const item=document.elementFromPoint(e.clientX,e.clientY)?.closest('.column');
      const from=pointer.from,index=pointer.index,to=item?Number(item.dataset.col):-1;
      resetDrag();
      if(to<0||!tryMove(from,index,to))toast('이동할 수 없는 위치입니다.',1350);
    }else resetDrag();
  }
  board.addEventListener('pointerup',finishPointer);
  board.addEventListener('pointercancel',resetDrag);
  $('stock').addEventListener('click',dealCards);
  $('undo').addEventListener('click',undo);
  $('hint').addEventListener('click',hint);
  $('skill').addEventListener('click',useSkill);
  $('new-game').addEventListener('click',()=>requestNewGame());
  $('difficulty').addEventListener('change',()=>requestNewGame(Number($('difficulty').value)));
  $('pause').addEventListener('click',()=>pauseGame());
  $('resume').addEventListener('click',()=>pauseGame(false));
  $('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').querySelector('span').textContent=soundOn?'ON':'OFF';play('click');toast(soundOn?'효과음이 활성화되었습니다.':'효과음이 꺼졌습니다.',1100);});
  $('fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('이 브라우저는 전체화면을 지원하지 않습니다.');}
    catch{toast('브라우저 설정으로 전체화면을 허용해주세요.');}
  });
  document.addEventListener('keydown',e=>{
    if(!game||!modal.hidden)return;
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    const k=e.key.toLowerCase();
    if(k==='escape'){selected=null;render();}
    if(game.paused){if(k==='p')pauseGame(false);return;}
    if(k==='u'){e.preventDefault();undo();}
    if(k==='h'){e.preventDefault();hint();}
    if(k==='d'){e.preventDefault();dealCards();}
    if(k==='p'){e.preventDefault();pauseGame(true);}
    if(e.code==='Space'&&e.target===document.body){e.preventDefault();useSkill();}
  });
  // Low allocation particle effects; drawn only while animating (no background polling).
  const canvas=$('fx'),ctx=canvas.getContext('2d');let particles=[],frame=0,raf=null;
  function sizeFx(){const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  window.addEventListener('resize',sizeFx);sizeFx();
  function burstAt(x,y,color,count=25){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,v=1.6+Math.random()*5;
      particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1,life:1,fade:.012+Math.random()*.02,color,r:1+Math.random()*3});
    }
    if(!raf)raf=requestAnimationFrame(drawFx);
  }
  function drawFx(){raf=null;ctx.clearRect(0,0,innerWidth,innerHeight);
    for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.045;p.life-=p.fade;ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
    if(particles.length)raf=requestAnimationFrame(drawFx);
  }
  function flashClears(clears){
    clears.forEach((entry,i)=>{
      const col=board.querySelector(`.column[data-col="${entry.column}"]`);
      if(!col)return;
      setTimeout(()=>{
        col.classList.remove('clear-flash'); void col.offsetWidth; col.classList.add('clear-flash');
        setTimeout(()=>col.classList.remove('clear-flash'),680);
      },i*120);
    });
  }
  function bossHit(x,y,text){
    const box=$('boss-art').closest('.boss-box');box.classList.remove('hit');void box.offsetWidth;box.classList.add('hit');
    clearTimeout(hitTimer);hitTimer=setTimeout(()=>box.classList.remove('hit'),530);
    burstAt(x,y,'#fe9b74',48);
    const pop=document.createElement('div');pop.className='battle-text';pop.textContent=text;pop.style.left=Math.max(12,x-95)+'px';pop.style.top=y+'px';document.body.append(pop);setTimeout(()=>pop.remove(),1200);play('hit');
  }
  setInterval(()=>{
    if(!game)return;
    const now=Date.now(),delta=Math.min((now-lastTick)/1000,2);lastTick=now;
    if(!game.paused && game.completed<8 && !document.hidden && modal.hidden){
      game.elapsed+=delta;$('time').textContent=formatTime(game.elapsed);
      if(++saveTick%15===0)save();
      // Streak is reset after 9 seconds of inactivity but does not need to rerender cards.
      if(game.combo>0&&now-game.lastActionTime>=9000){game.combo=0;$('combo').textContent='×0';}
    }
  },1000);
  document.addEventListener('visibilitychange',()=>lastTick=Date.now());
  window.addEventListener('beforeunload',save);
  if(load()){render();toast('저장된 작전을 복원했습니다.');}else createNewGame(1);
  if(window.matchMedia('(pointer:coarse)').matches)setTimeout(()=>toast('모바일: 카드 탭 → 이동할 열 탭으로도 조작할 수 있습니다.',2600),1100);
})();
