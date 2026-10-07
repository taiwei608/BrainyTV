const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const events = {};
let screen;
const context = vm.createContext({window:{addEventListener(name,fn){events['window-'+name]=fn;}}, document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',scrollTop:0,querySelector(){return null;}});return elements.get(id);},addEventListener(name,fn){events[name]=fn;}},requestAnimationFrame:fn=>fn(),focusFirst(){},focusWithoutScroll(){},showScreen:s=>screen=s});
vm.runInContext(fs.readFileSync('pokemon-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('pokemon.js','utf8')+'\nthis.PokemonTest = Pokemon;',context);
const data=context.window.POKEMON_DATA, api=context.PokemonTest;
const html=()=>elements.get('pokemonContent').innerHTML;
function click(action,value=''){events.click({target:{closest(){return {dataset:{poke:action,value:String(value)}};}}});}
for(const [id,count] of [[31,400],[32,200],[33,243]])assert.equal(data.species.filter(s=>s.dex.some(d=>d[0]===id)).length,count);
assert.equal(data.types.length,18);
assert.equal(data.efficacy.length,324);
assert.equal(api.multiplier(10,12,9),4); // Fire against Grass/Steel.
assert.equal(api.multiplier(13,5,11),0); // Electric cannot hit Ground/Water.
assert.equal(api.multiplier(10,11,16),0.25);
assert.equal(api.multiplier(10,12,12),2);
for(const p of data.pokemon){assert.ok(!p.slug.includes('-mega')&&!p.slug.includes('-gmax'));assert.ok(data.species.some(s=>s.id===p.species));assert.equal(p.stats.length,6);for(const m of p.moves)assert.ok(data.moves[m[0]]);}
api.open(); assert.equal(screen,'pokemon');assert.match(html(),/屬性與相剋/);
click('types');assert.equal((html().match(/class="poke-type-row"/g)||[]).length,18);
assert.equal((html().match(/data-multiplier=/g)||[]).length,72);
assert.doesNotMatch(html(),/data-poke="(?:attack|defense|second)"/);
assert.match(html(),/×0.5/);assert.match(html(),/×0 /);api.back();
click('dex');assert.match(html(),/共 400 筆/);assert.match(html(),/新葉喵/);
click('page',1);assert.match(html(),/第 2 \/ 34 頁/);api.back();click('dex');
context.document.getElementById('pokeQuery').value='皮卡丘';events.submit({target:{id:'pokemonSearch'},preventDefault(){}});assert.match(html(),/共 1 筆/);
click('select',25);assert.match(html(),/全國 #0025/);click('tab','moves');assert.match(html(),/Lv\./);assert.match(html(),/命中/);assert.match(html(),/PP/);
click('tab','evolution');assert.match(html(),/雷之石/);api.back();assert.match(html(),/共 1 筆/);
click('clear');click('region',32);assert.match(html(),/共 200 筆/);click('region',33);assert.match(html(),/共 243 筆/);
api.back();api.back();assert.equal(screen,'games');
assert.match(api.condition({relative_physical_stats:'equal'}),/攻擊 = 防禦/);
assert.match(api.condition({evolution_trigger_id:'gimmighoul-coins'}),/999/);
assert.match(api.condition({used_move_id:'憤怒之拳',minimum_move_count:20}),/憤怒之拳/);
const panel=elements.get('pokemonContent');panel.scrollTop=0;panel.clientHeight=400;panel.scrollHeight=1000;
context.document.activeElement={matches:()=>true};let consumed=false;
events['window-keydown']({key:'ArrowDown',preventDefault(){},stopImmediatePropagation(){consumed=true;}});
assert.equal(panel.scrollTop,110);assert.ok(consumed);
assert.equal(data.evolution.find(e=>e.id===25).conditions[0].minimum_happiness,'160');
console.log('PASS: all three regional dex counts, form and move integrity, type multipliers, search, paging, detail, learnsets, evolution and Back navigation.');
