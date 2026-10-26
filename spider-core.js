/* SPIDER CORE — self-contained rules engine. No network dependencies. */
(function (root, factory) {
  const API = factory();
  if (typeof module === 'object' && module.exports) module.exports = API;
  root.SpiderCore = API;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SUIT_SETS = {1:['S'], 2:['S','H'], 4:['S','H','D','C']};
  const deepCopy = obj => JSON.parse(JSON.stringify(obj));
  function shuffled(array, rng=Math.random) {
    for (let i = array.length-1;i>0;i--) {
      const j=Math.floor(rng()*(i+1));[array[i],array[j]]=[array[j],array[i]];
    }
    return array;
  }
  function createGame(difficulty=1, rng=Math.random) {
    if (!SUIT_SETS[difficulty]) throw Error('Unknown difficulty');
    const suits=SUIT_SETS[difficulty], copies=8/suits.length;
    const deck=[];let id=0;
    for (const suit of suits) for(let copy=0;copy<copies;copy++) for(let rank=1;rank<=13;rank++)
      deck.push({id:++id,suit,rank,faceUp:false});
    shuffled(deck,rng);
    const columns=Array.from({length:10},()=>[]);
    let pos=0;
    for(let col=0;col<10;col++){
      const count=col<4?6:5;
      for(let j=0;j<count;j++){
        const card=deck[pos++];card.faceUp=(j===count-1);columns[col].push(card);
      }
    }
    return {difficulty,columns,stock:deck.slice(pos),completed:0,score:500,moves:0,
      combo:0,lastActionTime:0,energy:0,bossDamage:0,skillUses:0,elapsed:0,paused:false};
  }
  function isMovableSequence(column,index){
    if(!Number.isInteger(index)||index<0||index>=column.length||!column[index].faceUp) return false;
    for(let i=index;i<column.length-1;i++){
      if(!column[i+1].faceUp || column[i].suit!==column[i+1].suit || column[i].rank!==column[i+1].rank+1) return false;
    }
    return true;
  }
  function isValidMove(game,from,index,to){
    if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||from<0||from>9||to<0||to>9) return false;
    const source=game.columns[from],target=game.columns[to];
    if(!isMovableSequence(source,index))return false;
    return !target.length || target[target.length-1].rank === source[index].rank+1;
  }
  function revealLast(column){
    if(column.length && !column[column.length-1].faceUp){column[column.length-1].faceUp=true;return 1;}return 0;
  }
  function resolveRuns(game){
    const clears=[];
    let again=true;
    while(again){
      again=false;
      for(let c=0;c<10;c++){
        const col=game.columns[c];
        if(col.length<13)continue;
        const tail=col.slice(-13),suit=tail[0].suit;
        if(tail.every((card,i)=>card.faceUp&&card.suit===suit&&card.rank===13-i)){
          col.splice(-13);game.completed++;game.score+=100;game.energy=Math.min(100,game.energy+36);
          if(game.completed%2===0) game.bossDamage=0;
          revealLast(col);
          clears.push({column:c,suit});
          again=true;
          break;
        }
      }
    }
    return clears;
  }
  function applyMove(game,from,index,to,now=Date.now()){
    if(!isValidMove(game,from,index,to))return null;
    const next=deepCopy(game),src=next.columns[from],dest=next.columns[to];
    const beforeReveal = src.length>index && index>0&&!src[index-1].faceUp;
    dest.push(...src.splice(index));
    const revealed=revealLast(src);
    next.moves++;next.score=Math.max(0,next.score-1);
    next.combo=(now-next.lastActionTime<9000)?Math.min(next.combo+1,99):1;
    next.lastActionTime=now;
    if(next.combo>1)next.score+=(Math.min(next.combo,8)-1)*2;
    next.energy=Math.min(100,next.energy+8+(revealed?7:0));
    next.bossDamage=Math.min(45,next.bossDamage+1);
    const clears=resolveRuns(next);
    return {game:next,revealed:Boolean(revealed || beforeReveal),clears};
  }
  function deal(game){
    if(game.stock.length<10 || game.columns.some(col=>col.length===0))return null;
    const next=deepCopy(game);
    for(let c=0;c<10;c++){const card=next.stock.shift();card.faceUp=true;next.columns[c].push(card);}
    next.moves++;next.score=Math.max(0,next.score-1);next.combo=0;next.lastActionTime=0;
    next.bossDamage=Math.min(45,next.bossDamage+2);
    return {game:next,clears:resolveRuns(next)};
  }
  function useSkill(game){
    if(game.energy<100)return null;
    const next=deepCopy(game);next.energy=0;next.bossDamage=Math.min(45,next.bossDamage+30);
    next.score+=30;next.skillUses++;
    return next;
  }
  function findMoves(game){
    const results=[];
    for(let from=0;from<10;from++){
      const col=game.columns[from];
      for(let i=col.length-1;i>=0;i--){
        if(!isMovableSequence(col,i))break;
        for(let to=0;to<10;to++){
          if(!isValidMove(game,from,i,to))continue;
          const target=game.columns[to],card=col[i];
          // Sort: reveals covered cards > builds a matching suit > unblocks stacks; empty columns last.
          const reveals=i>0&&!col[i-1].faceUp;
          let weight=(reveals?120:0)+(target.length&&target[target.length-1].suit===card.suit?70:0);
          weight+=col.length-i>1?12:0;
          if(!target.length)weight-=38;
          if(target.length && target[target.length-1].suit!==card.suit)weight-=23;
          results.push({from,index:i,to,weight});
        }
      }
    }
    return results.sort((a,b)=>b.weight-a.weight);
  }
  function getStage(game){return Math.min(4,Math.floor(game.completed/2)+1);}
  function stageShield(game){
    if(game.completed===8)return 0;
    const seals=game.completed%2;
    return Math.max(0,100-seals*50-Math.min(45,game.bossDamage));
  }
  function validate(game){
    if(!game||!SUIT_SETS[game.difficulty]||!Array.isArray(game.columns)||game.columns.length!==10||!Array.isArray(game.stock))return false;
    const cards=[...game.stock,...game.columns.flat()];
    if(cards.some(c=>!c||!Number.isInteger(c.rank)||c.rank<1||c.rank>13||!SUIT_SETS[game.difficulty].includes(c.suit)||typeof c.faceUp!=='boolean'))return false;
    if(!Number.isInteger(game.completed)||game.completed<0||game.completed>8||cards.length+13*game.completed!==104)return false;
    if(new Set(cards.map(c=>c.id)).size!==cards.length)return false;
    for(const col of game.columns){let faceUpSeen=false;for(const c of col){if(c.faceUp)faceUpSeen=true;else if(faceUpSeen)return false;}}
    return true;
  }
  return {createGame,isMovableSequence,isValidMove,applyMove,deal,useSkill,findMoves,
    getStage,stageShield,validate,deepCopy};
});
