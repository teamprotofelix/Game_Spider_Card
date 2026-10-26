'use strict';
const assert=require('node:assert/strict');
const Core=require('../spider-core');
function deterministic(){let seed=234542;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
for(const difficulty of [1,2,4]){
 const g=Core.createGame(difficulty,deterministic());
 assert.equal(g.columns.length,10);
 assert.deepEqual(g.columns.map(c=>c.length),[6,6,6,6,5,5,5,5,5,5]);
 assert.equal(g.stock.length,50);
 assert.equal(g.columns.flat().filter(c=>c.faceUp).length,10);
 assert.equal(g.columns.flat().length+g.stock.length,104);
 assert.equal(Core.validate(g),true);
 const suitCount={};for(const c of [...g.columns.flat(),...g.stock]) suitCount[c.suit]=(suitCount[c.suit]||0)+1;
 assert.equal(Object.keys(suitCount).length,difficulty);
 assert.equal(Object.values(suitCount).every(n=>n===104/difficulty),true);
 let dealt=g;
 for(let i=0;i<5;i++){
  const res=Core.deal(dealt);assert.ok(res,`stock deal ${i}`);
  dealt=res.game;assert.equal(dealt.stock.length,40-i*10);assert.equal(dealt.columns.flat().length+dealt.stock.length+13*dealt.completed,104);
 }
 assert.equal(Core.deal(dealt),null);
}
function card(rank,suit='S',faceUp=true,id=rank){return {rank,suit,faceUp,id};}
assert.equal(Core.isMovableSequence([card(10),card(9),card(8)],0),true);
assert.equal(Core.isMovableSequence([card(10,'S'),card(9,'H')],0),false);
assert.equal(Core.isMovableSequence([card(10,'S',false),card(9)],0),false);
assert.equal(Core.isMovableSequence([card(10),card(8)],0),false);
const g=Core.createGame(2,deterministic());
g.columns=[ [card(7,'H',false,2000),card(9,'S',true,2001),card(8,'S',true,2002)], [card(10,'H',true,2003)], [card(9,'H',true,2004)],[],[],[],[],[],[],[] ];
assert.equal(Core.isValidMove(g,0,1,1),true);
assert.equal(Core.isValidMove(g,0,1,2),false);
assert.equal(Core.isValidMove(g,0,1,3),true);
assert.equal(Core.isValidMove(g,0,1,0),false);
const result=Core.applyMove(g,0,1,1,111111);
assert.ok(result);assert.equal(result.game.columns[0][0].faceUp,true);
assert.equal(result.game.columns[1].length,3);assert.equal(result.game.moves,1);
assert.equal(result.game.score,499);assert.equal(result.game.energy,15);
assert.equal(g.columns[0][0].faceUp,false,'immutable application');
const clearGame=Core.createGame(1,deterministic());
clearGame.columns=Array.from({length:10},()=>[]);
clearGame.columns[0]=[card(1,'S',true,900)];
clearGame.columns[1]=Array.from({length:12},(_,i)=>card(13-i,'S',true,1000+i));
const clear=Core.applyMove(clearGame,0,0,1,123456);
assert.ok(clear);assert.equal(clear.clears.length,1);assert.equal(clear.game.completed,1);
assert.equal(clear.game.columns[1].length,0);assert.equal(clear.game.score,599);
assert.equal(Core.useSkill(clear.game),null);
const powered=Core.deepCopy(clear.game);powered.energy=100;
const skill=Core.useSkill(powered);assert.equal(skill.energy,0);assert.equal(skill.bossDamage,31);
assert.equal(skill.score,629);assert.equal(powered.energy,100);
const withEmpty=Core.createGame(1,deterministic());withEmpty.columns[0]=[];
assert.equal(Core.deal(withEmpty),null);
const bad=Core.createGame(1,deterministic());bad.columns[0][0].rank=15;assert.equal(Core.validate(bad),false);
console.log('PASS: 1/2/4 suits, 104-card invariant, 5 stock deals, move legality, reveal, auto-clear, undo snapshots, energy skill, validation');
