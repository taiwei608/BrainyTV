/* Offline reference browser. No player records are modified. */
const Pokemon = (() => {
  const data = window.POKEMON_DATA;
  const colors = ['#a8a878','#c03028','#a890f0','#a040a0','#d6aa43','#a89832','#91a820','#705898','#9999ba','#f08030','#6890f0','#78c850','#e4be22','#f85888','#70c8c8','#7038f8','#705848','#d78aaa'];
  // PokeAPI type IDs: normal, fighting, flying, poison, ground, rock, bug,
  // ghost, steel, fire, water, grass, electric, psychic, ice, dragon, dark, fairy.
  let view = 'home', page = 0, dex = '31', query = '', typeFilter = '', selected = null, movePage = 0, method = '1', tab = 'overview';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button = (label, action, value = '', extra = '') => `<button class="btn secondary" data-poke="${action}" data-value="${esc(value)}" ${extra}>${label}</button>`;
  function badge(id) { const t=data.types.find(t=>t.id===+id); return t?`<span class="poke-type" style="--type-color:${colors[id-1]}"><span class="poke-type-symbol" aria-hidden="true" style="background-image:url(assets/pokemon/types/${id}.png)"></span> ${t.name}</span>`:''; }
  function multiplier(a,b,c=0) { const value = target => data.efficacy.find(r=>r[0]===+a&&r[1]===+target)?.[2]??1; return value(b)*(c&&+c!==+b?value(c):1); }
  const species = id => data.species.find(s=>s.id===+id);
  const form = id => data.pokemon.find(p=>p.id===+id);
  const formLabels = {alola:'阿羅拉',galar:'伽勒爾',hisui:'洗翠',paldea:'帕底亞',female:'雌性',male:'雄性', 'paldea-combat-breed':'帕底亞・鬥戰種','paldea-blaze-breed':'帕底亞・火熾種','paldea-aqua-breed':'帕底亞・水瀾種','original-cap':'初始帽子','hoenn-cap':'豐緣帽子','sinnoh-cap':'神奧帽子','unova-cap':'合眾帽子','kalos-cap':'卡洛斯帽子','alola-cap':'阿羅拉帽子','partner-cap':'就決定是你了帽子','world-cap':'世界帽子','family-of-three':'三隻家庭','family-of-four':'四隻家庭','two-segment':'兩節','three-segment':'三節','white-striped':'白條紋','red-striped':'紅條紋','blue-striped':'藍條紋'};
  function formLabel(p) { return p.default?'':formLabels[p.form]||p.form||p.slug; }
  function title(p) { return `${species(p.species)?.name || p.slug}${formLabel(p)?`（${formLabel(p)}）`:''}`; }
  function render(focus=true) {
    const root=$('pokemonContent'); $('pokemonTitle').textContent={home:'寶可夢專區',types:'屬性與相剋',dex:'朱／紫圖鑑',detail:selected?title(selected):'寶可夢資料'}[view];
    $('pokemonBack').textContent=view==='home'?'返回活動':view==='detail'?'返回圖鑑':'返回專區';
    if (!data) { root.innerHTML='<p role="alert">資料無法載入，請重新整理頁面。</p>'; return; }
    root.innerHTML=view==='home'?home():view==='types'?types():view==='dex'?library():detail();
    root.scrollTop=0;
    if(focus) requestAnimationFrame(()=>view==='types'?focusWithoutScroll($('pokemonBack')):focusFirst(root));
  }
  function home() { return `<div class="poke-home">${button('✦ 屬性與相剋<br><small>18 種屬性・圖示・攻擊倍率表</small>','types')}${button('◉ 朱／紫圖鑑<br><small>編號・進化・學招・招式威力</small>','dex')}</div><p class="poke-note">包含帕底亞、北上與藍莓圖鑑，另列有朱／紫學招資料的其他寶可夢。文字與屬性圖示可離線查看，寶可夢圖片需要網路。</p><p class="poke-note">資料：PokéAPI・${esc(data.updated)} 快照。招式倍率以一般對戰屬性計算，不包含特性、道具、太晶化或特殊招式效果。</p>`; }
  function types() {
    return `<p class="poke-note">每張表顯示該屬性攻擊其他屬性的倍數。用上下鍵往下看全部 18 種屬性。</p><div class="poke-type-chart">${data.types.map(a=>`<section class="poke-type-row" tabindex="0" data-poke-scroll aria-label="${a.name}屬性攻擊倍率，上下鍵捲動"><h2>${badge(a.id)} 攻擊其他屬性</h2><div class="poke-multiplier-groups">${[[2,'效果絕佳'],[0.5,'效果不好'],[0,'無效'],[1,'一般效果']].map(([value,label])=>{const targets=data.types.filter(b=>multiplier(a.id,b.id)===value);return `<div class="poke-multiplier-group" data-multiplier="${value}"><h3>×${value} <small>${label}</small></h3><div>${targets.length?targets.map(b=>badge(b.id)).join(' '):'<span class="poke-note">無</span>'}</div></div>`;}).join('')}</div></section>`).join('')}</div>`;
  }
  function entries() {
    return data.species.filter(s=>(dex==='all'||s.dex.some(d=>d[0]===+dex))&&(!query||`${s.name} ${s.slug} ${s.id} ${s.dex.map(d=>d[1]).join(' ')}`.toLowerCase().includes(query.toLowerCase()))&&(!typeFilter||data.pokemon.some(p=>p.species===s.id&&p.types.includes(+typeFilter)))).sort((a,b)=>dex==='all'?a.id-b.id:(a.dex.find(d=>d[0]===+dex)?.[1]||0)-(b.dex.find(d=>d[0]===+dex)?.[1]||0));
  }
  function pager(total,size,action,current) { const count=Math.max(1,Math.ceil(total/size)); return `<div class="poke-pager">${button('上一頁',action,current-1,current===0?'disabled':'')}<span>第 ${current+1} / ${count} 頁・共 ${total} 筆</span>${button('下一頁',action,current+1,current>=count-1?'disabled':'')}</div>`; }
  function library() {
    const list=entries(); page=Math.min(page,Math.max(0,Math.ceil(list.length/12)-1));
    return `<div class="poke-toolbar">${[[31,'帕底亞'],[32,'北上'],[33,'藍莓'],['all','全部／其他可用']].map(([id,n])=>button(n,'region',id,`aria-pressed="${dex===String(id)}"`)).join('')}</div><form id="pokemonSearch" class="poke-search"><label for="pokeQuery">名稱或編號</label><input id="pokeQuery" value="${esc(query)}" placeholder="例如：皮卡丘、25、sprigatito" autocomplete="off"><button class="btn primary" type="submit">搜尋</button>${button('清除','clear')}</form><div class="poke-toolbar"><span>屬性篩選：</span>${button('全部屬性','filter','',`aria-pressed="${!typeFilter}"`)}${data.types.map(t=>button(badge(t.id),'filter',t.id,`aria-pressed="${typeFilter===String(t.id)}"`)).join('')}</div>${pager(list.length,12,'page',page)}<div class="poke-library">${list.slice(page*12,page*12+12).map(s=>{const p=(typeFilter?data.pokemon.find(p=>p.species===s.id&&p.types.includes(+typeFilter)):null)||data.pokemon.find(p=>p.species===s.id&&p.default)||data.pokemon.find(p=>p.species===s.id);return button(`<small>${dex==='all'?'全國':({31:'帕底亞',32:'北上',33:'藍莓'})[dex]} #${String(dex==='all'?s.id:s.dex.find(d=>d[0]===+dex)[1]).padStart(3,'0')}</small><strong>${esc(s.name)}</strong><span>${p.types.map(badge).join(' ')}</span>`,'select',p.id);}).join('')||'<p role="status">沒有符合的寶可夢，試試清除搜尋或屬性篩選。</p>'}</div>`;
  }
  const conditionNames={evolution_trigger_id:'方式',trigger_item_id:'使用道具',minimum_level:'最低等級',gender_id:'性別',location_id:'地點',held_item_id:'攜帶道具',time_of_day:'時段',known_move_id:'已學會招式',known_move_type_id:'已學會招式屬性',minimum_happiness:'親密度',minimum_beauty:'美麗度',minimum_affection:'友好度',relative_physical_stats:'攻擊／防禦',party_species_id:'同行寶可夢',party_type_id:'同行屬性',trade_species_id:'交換對象',needs_overworld_rain:'下雨',turn_upside_down:'主機倒置',minimum_steps:'同行步數',minimum_damage_taken:'受到傷害',used_move_id:'使用招式',minimum_move_count:'使用次數',required_pokemon_form_id:'進化前型態',evolved_pokemon_form_id:'進化後型態',percentage_chance:'型態機率（%）',needs_multiplayer:'集友圈',region_id:'進化地區',nature_bitmask:'性格條件'};
  const triggers={'level-up':'升級',trade:'連線交換','use-item':'使用道具',shed:'隊伍有空位及精靈球','other':'特殊條件','three-critical-hits':'一場對戰命中要害 3 次','take-damage':'受到傷害後符合指定條件','spin':'旋轉角色','tower-of-darkness':'使用惡之掛軸','tower-of-waters':'使用水之掛軸','agile-style-move':'使用迅疾招式（其他世代）','strong-style-move':'使用剛猛招式（其他世代）','recoil-damage':'累積反作用力傷害後升級','use-move':'使用指定招式後升級','in-battle-level-up':'對戰中升級','three-defeated-bisharp':'打倒 3 隻帶著頭領憑證、率領駒刀小兵的劈斬司令，再升級','gimmighoul-coins':'收集 999 枚索財靈的硬幣後升級'};
  function condition(c) { return Object.entries(c).map(([k,v])=>{
    if(k==='evolution_trigger_id') v=triggers[v]||v;
    if(k==='gender_id') v=+v===1?'雌性':'雄性';
    if(k==='time_of_day') v=({day:'白天',night:'夜晚',dusk:'黃昏'})[v]||v;
    if(k==='relative_physical_stats') v=({'1':'攻擊 > 防禦','-1':'攻擊 < 防禦','0':'攻擊 = 防禦',equal:'攻擊 = 防禦'})[v]||v;
    if(['needs_overworld_rain','turn_upside_down','needs_multiplayer'].includes(k))v='需要';
    if(k==='minimum_steps')v=`${v} 步（Let’s Go 同行後，寶可夢在球外時升級）`;
    if(k==='region_id')v=({'1':'關都','7':'阿羅拉（朱／紫不能在此進化）','8':'伽勒爾（朱／紫不能在此進化）','9':'洗翠（朱／紫不能在此進化）','10':'帕底亞'})[v]||v;
    if(k==='nature_bitmask')v=+v===10473025?'高調：勤奮、勇敢、固執、頑皮、坦率、淘氣、樂天、急躁、爽朗、天真、馬虎、自大、浮躁': '低調：上述高調型態以外的 12 種性格';
    if(k.endsWith('type_id')) v=data.types.find(t=>t.id===+v)?.name||v;
    return `${conditionNames[k]||k}：${esc(v)}`;
  }).join('、')||'來源未列條件'; }
  const evolutionNotes = {899:'朱／紫不能由驚角鹿進化；需在《傳說 阿爾宙斯》進化後透過 Pokémon HOME 傳入。',900:'朱／紫不能使用黑奇石進化；可在藍莓圖鑑區域捕捉劈斧螳螂，或由其他遊戲傳入。',901:'朱／紫不能使用泥炭塊進化；一般月月熊需由其他遊戲傳入，赫月型態為北上特定事件捕捉，不是進化。'};
  function detail() {
    const p=selected,s=species(p.species),variants=data.pokemon.filter(f=>f.species===s.id);
    const heading=`<div class="poke-toolbar">${['overview','evolution','moves'].map((t,i)=>button(['基本資料','怎麼進化','學招與威力'][i],'tab',t,`aria-pressed="${tab===t}"`)).join('')}</div>`;
    const formButtons=variants.length>1?`<div class="poke-toolbar"><span>型態：</span>${variants.map(f=>button(esc(formLabel(f)||'一般型態'),'form',f.id,`aria-pressed="${f.id===p.id}"`)).join('')}</div>`:'';
    if(tab==='overview') return heading+formButtons+`<div class="poke-overview"><img width="240" height="240" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${esc(title(p))}" loading="lazy"><div><h2>${esc(title(p))}</h2><p>全國 #${String(s.id).padStart(4,'0')} ${s.dex.map(d=>`／${({31:'帕底亞',32:'北上',33:'藍莓'})[d[0]]} #${d[1]}`).join(' ')}</p><p>${p.types.map(badge).join(' ')}</p><p>特性：${p.abilities.map(a=>`${esc(a[0])}${a[1]?'（隱藏）':''}`).join('、')}</p><div class="poke-results" tabindex="0" data-poke-scroll aria-label="屬性或能力資料，上下鍵捲動">${p.stats.map((n,i)=>`<div>${['HP','攻擊','防禦','特攻','特防','速度'][i]} <strong>${n}</strong></div>`).join('')}</div></div></div><h2>防守弱點與抗性</h2><div class="poke-results" tabindex="0" data-poke-scroll aria-label="屬性或能力資料，上下鍵捲動">${data.types.map(t=>`<div>${badge(t.id)} <strong>×${multiplier(t.id,p.types[0],p.types[1])}</strong></div>`).join('')}</div>`;
    if(tab==='evolution') return heading+`<h2>進化家族</h2><div class="poke-evolution">${data.evolution.filter(e=>e.chain===s.chain).map(e=>{const parent=data.evolution.find(a=>a.id===e.parent);const target=data.pokemon.find(f=>f.species===e.id&&f.default);return `<section>${evolutionNotes[e.id]?`<p class="poke-note">${evolutionNotes[e.id]}</p>`:""}<h3>${parent?esc(parent.name)+' → ':''}${esc(e.name)}</h3>${e.parent?`<p>${e.conditions.map(condition).join('<br>或：')||'進化條件未收錄'}</p>`:'<p>家族起點</p>'}${target?button('查看 '+esc(e.name),'select',target.id):''}</section>`;}).join('')}</div><p class="poke-note">不同型態可能有不同進化方法，請留意進化前型態及進化地區。阿羅拉／洗翠等地區限定進化需從其他遊戲傳入，不能在朱／紫直接完成。來源未列條件不代表無法進化。</p>`;
    const list=p.moves.filter(m=>String(m[1])===method).sort((a,b)=>a[2]-b[2]||a[0]-b[0]); movePage=Math.min(movePage,Math.max(0,Math.ceil(list.length/8)-1));
    return heading+formButtons+`<div class="poke-toolbar">${[['1','升級'],['4','招式學習器'],['2','蛋招式'],['3','教授／其他']].map(([m,n])=>button(n,'method',m,`aria-pressed="${method===m}"`)).join('')}</div><p class="poke-note">僅列 scarlet-violet 版本資料。等級 0 代表進化時學會，等級 1 代表初始招式。威力「—」代表變化招式或威力依條件決定，不是 0 傷害。</p>${pager(list.length,8,'move-page',movePage)}<table class="poke-moves" tabindex="0" data-poke-scroll aria-label="招式資料，上下鍵捲動"><thead><tr><th>學習</th><th>招式</th><th>屬性</th><th>分類</th><th>威力</th><th>命中</th><th>PP</th></tr></thead><tbody>${list.slice(movePage*8,movePage*8+8).map(m=>{const a=data.moves[m[0]];return `<tr><td>${method==='1'?(m[2]===0?'進化':`Lv. ${m[2]}`):'—'}</td><td>${esc(a.name)}</td><td>${badge(a.type)}</td><td>${['','變化','物理','特殊'][a.category]}</td><td>${a.power??'—'}</td><td>${a.accuracy===null?'—':a.accuracy+'%'}</td><td>${a.pp}</td></tr>`;}).join('')||'<tr><td colspan="7">此型態／學習方式沒有朱／紫資料。</td></tr>'}</tbody></table>`;
  }
  function open() { view='home'; showScreen('pokemon'); render(); }
  function back() { if(view==='home') showScreen('games');else {view=view==='detail'?'dex':'home';render();} }
  // Reference tables have no buttons in their rows. Let the remote scroll them
  // while focused, then hand navigation back to the shared focus controller.
  window.addEventListener?.('keydown',e=>{
    if(document.activeElement?.id==='pokeQuery'&&e.key==='Enter'){
      e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)$('pokemonSearch').requestSubmit();return;
    }
    if(!document.activeElement?.matches('[data-poke-scroll]'))return;
    const root=$('pokemonContent'), step=e.key==='ArrowDown'?110:e.key==='ArrowUp'?-110:0;
    if(!step || (step>0&&root.scrollTop+root.clientHeight>=root.scrollHeight-2)||(step<0&&root.scrollTop<=0))return;
    e.preventDefault();e.stopImmediatePropagation();root.scrollTop+=step;
  },{capture:true});
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-poke]');if(!b)return; const action=b.dataset.poke,value=b.dataset.value;
    if(action==='back')return back();
    if(action==='types'||action==='dex')view=action;
    if(action==='region'){dex=value;page=0;}if(action==='filter'){typeFilter=value;page=0;}
    if(action==='clear'){query='';typeFilter='';page=0;}if(action==='page')page=+value;
    if(action==='select'||action==='form'){selected=form(value);view='detail';movePage=0;if(action==='select')tab='overview';}
    if(action==='tab')tab=value;if(action==='method'){method=value;movePage=0;}if(action==='move-page')movePage=+value;
    render();
    if(action==='filter')requestAnimationFrame(()=>{const target=$('pokemonContent').querySelector(`[data-poke="${action}"][data-value="${value}"]`);if(target){focusWithoutScroll(target);target.scrollIntoView({block:'nearest'});}});
  });
  document.addEventListener('submit',e=>{if(e.target.id!=='pokemonSearch')return;e.preventDefault();query=$('pokeQuery').value.trim();page=0;render();});
  return {open,back,multiplier,condition};
})();
