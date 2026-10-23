/* Unit membership is curriculum data, independent of earned points or pacing. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GroveUnits=api;})(globalThis,()=>{
 const labels={K:'Kindergarten',1:'Grade 1',2:'Grade 2',3:'Grade 3',4:'Grade 4',5:'Grade 5'};
 function buildUnitGroups({units,cards,grade,selection,points={}}){
  const groups=[],selected=new Set(selection),byCharacter=new Map(cards.map(c=>[c.c,c])),covered=new Set();
  function add(g,number,chars,supplemental=false,additional=false){
   const title=(supplemental?'Extra set ':'Unit ')+number;
   groups.push({id:g+':'+title,g,number,t:title,f:(labels[g]||g)+' · '+title,s:additional?(labels[g]||g)+' · '+title:title,c:[...chars],a:additional,supplemental});
   for(const c of chars)covered.add(c);
  }
  for(const [n,chars]of units[grade]||[])add(grade,n,chars);
  const extra=cards.filter(c=>c.g?.includes(grade)&&!covered.has(c.c)).map(c=>c.c);
  const batch=['3','4','5'].includes(grade)?5:10;for(let i=0;i<extra.length;i+=batch)add(grade,i/batch+1,extra.slice(i,i+batch),true);
  const remaining=new Set([...selected].filter(c=>!covered.has(c)));
  for(const g of ['K','1','2','3','4','5'].filter(g=>g!==grade))for(const [n,chars]of units[g]||[])if([...chars].some(c=>remaining.has(c))){add(g,n,chars,false,true);for(const c of chars)remaining.delete(c);}
  const extras=new Map();for(const c of remaining){const g=byCharacter.get(c)?.g?.[0]||'?';if(!extras.has(g))extras.set(g,[]);extras.get(g).push(c);}
  for(const [g,chars]of extras)for(let i=0;i<chars.length;i+=10)add(g,i/10+1,chars.slice(i,i+10),true,true);
  const current=groups.findIndex(g=>g.g===grade&&!g.a&&g.c.some(c=>selected.has(c))&&g.c.some(c=>(points[c]||0)<5));
  return {groups,current};
 }
 return {buildUnitGroups};
});
