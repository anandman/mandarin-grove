/* Immutable portable views over injected, attributed curriculum data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroveCatalog=api;})(globalThis,()=>{
 const copy=value=>JSON.parse(JSON.stringify(value));
 function createCatalog({characters,units}){
  const cards=new Map(characters.map(c=>[c.c,copy(c)])),groups=new Map(units.map(u=>[u.id,copy(u)]));
  return {
   character:id=>cards.has(id)?copy(cards.get(id)):null,
   unit:id=>groups.has(id)?copy(groups.get(id)):null,
   selection:({units:ids=[],characters:extras=[],excluded=[]}={})=>{
    const blocked=new Set(excluded),seen=new Set(),chosen=[];
    for(const id of [...ids.flatMap(id=>groups.get(id)?.chars||[]),...extras])if(!blocked.has(id)&&!seen.has(id)&&cards.has(id)){seen.add(id);chosen.push(copy(cards.get(id)));}
    return chosen;
   }
  };
 }
 return {createCatalog};
});
