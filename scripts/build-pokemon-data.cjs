// Rebuild the offline dataset from PokeAPI's public CSV repository.
const fs = require('node:fs');
const path = require('node:path');
const base = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
function parse(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(value.replace(/\r$/, '')); value = ''; if (c === '\n') { rows.push(row); row = []; } }
    else value += c;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length === header.length).map(r => Object.fromEntries(header.map((k, i) => [k, r[i]])));
}
async function main() {
  const files = ['pokemon_species_names','pokemon_species','pokemon','pokemon_dex_numbers','pokemon_types','types','type_names','type_efficacy','moves','move_names','pokemon_moves','version_groups','pokemon_evolution','evolution_triggers','items','item_names','pokemon_stats','stats','pokemon_abilities','ability_names','abilities','pokemon_forms','location_names','locations','pokemon_form_names'];
  const data = {};
  // Limit download concurrency so rebuilding does not overwhelm the source.
  for (let i = 0; i < files.length; i += 3) await Promise.all(files.slice(i, i + 3).map(async name => {
    const res = await fetch(base + name + '.csv'); if (!res.ok) throw Error(`${name}: ${res.status}`);
    data[name] = parse(await res.text()); console.log(name, data[name].length);
  }));
  const names = (table, key) => Object.fromEntries(data[table].filter(r => r.local_language_id === '4').map(r => [r[key], r.name]));
  const speciesNames = names('pokemon_species_names','pokemon_species_id');
  const moveNames = names('move_names','move_id'); const itemNames = names('item_names','item_id');
  const abilityNames = names('ability_names','ability_id');
  const sv = data.version_groups.find(r => r.identifier === 'scarlet-violet').id;
  const dexNames = {31:'帕底亞',32:'北上',33:'藍莓'};
  const dex = data.pokemon_dex_numbers.filter(r => dexNames[r.pokedex_id]);
  const eligible = new Set(dex.map(r => r.species_id));
  const svPokemon = new Set(data.pokemon_moves.filter(r => r.version_group_id === sv).map(r => r.pokemon_id));
  const forms = data.pokemon.filter(r => svPokemon.has(r.id) || (eligible.has(r.species_id) && r.is_default === '1'));
  const translatedForms = names('pokemon_form_names','pokemon_form_id');
  const formNames = Object.fromEntries(data.pokemon_forms.map(r => [r.pokemon_id,translatedForms[r.id] || r.form_identifier]));
  const pokemonIds = new Set(forms.map(r => r.id));
  const learnsets = {}; const moveIds = new Set();
  data.pokemon_moves.filter(r => r.version_group_id === sv && pokemonIds.has(r.pokemon_id)).forEach(r => {
    (learnsets[r.pokemon_id] ||= []).push([+r.move_id,+r.pokemon_move_method_id,+r.level]); moveIds.add(r.move_id);
  });
  const species = data.pokemon_species.filter(r => forms.some(p => p.species_id === r.id)).map(r => ({id:+r.id,name:speciesNames[r.id] || r.identifier,slug:r.identifier,parent:+r.evolves_from_species_id,chain:+r.evolution_chain_id,dex:dex.filter(d => d.species_id === r.id).map(d => [+d.pokedex_id,+d.pokedex_number])}));
  const pokemon = forms.map(r => ({id:+r.id,species:+r.species_id,slug:r.identifier,form:formNames[r.id] || '',default:r.is_default === '1',types:data.pokemon_types.filter(t => t.pokemon_id === r.id).sort((a,b)=>a.slot-b.slot).map(t=>+t.type_id),stats:data.pokemon_stats.filter(s=>s.pokemon_id===r.id).map(s=>+s.base_stat),abilities:data.pokemon_abilities.filter(a=>a.pokemon_id===r.id).map(a=>[abilityNames[a.ability_id] || data.abilities.find(b=>b.id===a.ability_id)?.identifier, a.is_hidden==='1']),moves:learnsets[r.id] || []}));
  const moves = Object.fromEntries(data.moves.filter(r=>moveIds.has(r.id)).map(r=>[r.id,{name:moveNames[r.id]||r.identifier,type:+r.type_id,power:r.power?+r.power:null,accuracy:r.accuracy?+r.accuracy:null,pp:+r.pp,category:+r.damage_class_id}]));
  const chains = new Set(species.map(s=>s.chain));
  const locationNames = names('location_names','location_id');
  // The CSV also contains historical rules; prefer the source's current default
  // rules available by Scarlet/Violet, retaining branching regional forms.
  data.pokemon_evolution = data.pokemon_evolution.filter(e => !e.version_group_id || +e.version_group_id <= +sv);
  const latestEvolution = data.pokemon_evolution.filter(e => e.is_default === '1');
  data.pokemon_evolution = data.pokemon_evolution.filter(e => latestEvolution.some(d=>d.evolved_species_id===e.evolved_species_id) ? e.is_default === '1' : true);
  data.pokemon_evolution.forEach(e => {
    // Friendship thresholds were lowered in Gen VIII and remain 160 in SV.
    if (+e.minimum_happiness >= 220) e.minimum_happiness = '160';
    delete e.version_group_id; delete e.is_default;
    delete e.condition_expression;
    for(const key of ['required_pokemon_form_id','evolved_pokemon_form_id']) if(e[key]) {
      const f=data.pokemon_forms.find(f=>f.id===e[key]);
      const p=data.pokemon.find(p=>p.id===f?.pokemon_id);
      e[key]=p?`${speciesNames[p.species_id] || p.identifier}（${translatedForms[f.id] || f.form_identifier || '一般型態'}）`:e[key];
    }
    if(e.used_move_id) e.used_move_id=moveNames[e.used_move_id] || e.used_move_id;
    if(e.location_id) e.location_id=locationNames[e.location_id] || data.locations.find(l=>l.id===e.location_id)?.identifier || e.location_id;
    if(e.relative_physical_stats==='0')e.relative_physical_stats='equal';
  });
  const chainSpecies = data.pokemon_species.filter(s=>chains.has(+s.evolution_chain_id));
  const evolution = chainSpecies.map(r=>({id:+r.id,name:speciesNames[r.id]||r.identifier,parent:+r.evolves_from_species_id,chain:+r.evolution_chain_id,conditions:data.pokemon_evolution.filter(e=>e.evolved_species_id===r.id).map(e=>Object.fromEntries(Object.entries(e).filter(([k,v])=>!['id','evolved_species_id'].includes(k)&&v!==''&&v!=='0').map(([k,v])=>[k, k==='evolution_trigger_id'?data.evolution_triggers.find(t=>t.id===v)?.identifier:k==='trigger_item_id'||k==='held_item_id'?itemNames[v]||data.items.find(t=>t.id===v)?.identifier:k==='known_move_id'?moveNames[v]:k==='trade_species_id'||k==='party_species_id'?speciesNames[v]:v])))}));
  const types = data.types.filter(r=>+r.id<=18).map(r=>({id:+r.id,name:names('type_names','type_id')[r.id]||r.identifier,slug:r.identifier}));
  const output = {source:base,updated:new Date().toISOString().slice(0,10),version:'scarlet-violet',species,pokemon,moves,evolution,types,efficacy:data.type_efficacy.filter(r=>+r.damage_type_id<=18&&+r.target_type_id<=18).map(r=>[+r.damage_type_id,+r.target_type_id,+r.damage_factor/100])};
  fs.writeFileSync(path.join(__dirname,'../pokemon-data.js'),'// Generated by scripts/build-pokemon-data.cjs; see POKEMON_SOURCES.md.\nwindow.POKEMON_DATA = '+JSON.stringify(output)+';\n');
  console.log(`Built ${species.length} species, ${pokemon.length} forms, ${Object.keys(moves).length} moves.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
