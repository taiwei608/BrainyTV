const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('pokemon.js','utf8');
const dataSource=fs.readFileSync('pokemon-data.js','utf8');
function setup(){
  const elements=new Map(),scripts=[],events={};let screen,focused;
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',querySelector:()=>null});return elements.get(id)};
  const context=vm.createContext({window:{addEventListener(){}},document:{getElementById:element,head:{appendChild:s=>scripts.push(s)},createElement:()=>({remove(){this.removed=true}}),addEventListener:(name,fn)=>events[name]=fn},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),showScreen:s=>screen=s,focusWithoutScroll:el=>focused=el,focusFirst(){}});
  vm.runInContext(source+'\nthis.api=Pokemon;',context);
  return {context,scripts,element,events,get screen(){return screen},get focused(){return focused}};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
(async()=>{
  assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/<script[^>]*src="pokemon-data/);
  let env=setup();assert.equal(env.scripts.length,0);
  env.context.api.open();assert.equal(env.screen,'pokemon');assert.match(env.element('pokemonContent').innerHTML,/正在載入/);assert.equal(env.focused,env.element('pokemonBack'));
  env.context.api.open();assert.equal(env.scripts.length,1);
  env.context.api.back();assert.equal(env.screen,'games');
  vm.runInContext(dataSource,env.context);env.scripts[0].onload();await flush();
  assert.match(env.element('pokemonContent').innerHTML,/正在載入/);
  env.context.api.open();assert.match(env.element('pokemonContent').innerHTML,/屬性與相剋/);assert.equal(env.scripts.length,1);
  env=setup();env.context.api.open();env.scripts[0].onerror();await flush();
  assert.match(env.element('pokemonContent').innerHTML,/資料載入失敗/);assert.ok(env.scripts[0].removed);
  env.events.click({target:{closest:()=>({dataset:{poke:'retry'}})}});assert.equal(env.scripts.length,2);
  vm.runInContext(dataSource,env.context);env.scripts[1].onload();await flush();assert.match(env.element('pokemonContent').innerHTML,/屬性與相剋/);
  console.log('PASS: no startup data request, shared loading, Back during loading, cached reopen, network failure and retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
