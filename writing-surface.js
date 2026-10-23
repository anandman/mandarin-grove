/* One writing palette and responsive engine lifecycle, independent of learner state. */
const WritingSurface = (() => {
 const guides=new Map();
 const palette=box=>{const css=getComputedStyle(box),read=(name,fallback)=>css.getPropertyValue(name).trim()||fallback;return {
  strokeColor:read('--paper-ink','#242B24'),radicalColor:read('--paper-ink','#242B24'),drawingColor:read('--paper-ink','#242B24'),
  outlineColor:read('--paper-outline','#857E70'),highlightColor:read('--ac','#F57727')
 };};
 function dispose(entry){entry.disposed=true;entry.observer?.disconnect();entry.writer.cancelQuiz();}
 function disposeDetached(){for(const [box,entry]of guides)if(!box.isConnected){dispose(entry);guides.delete(box);}}
 function create(box,char,options={}){
  disposeDetached();const previous=guides.get(box);if(previous)dispose(previous);
  const width=box.clientWidth||300,height=box.clientHeight||width;
  const writer=HanziWriter.create(box,char,{...options,...palette(box),width,height});
  const entry={writer,width,height,observer:null,disposed:false};guides.set(box,entry);
  const quiz=writer.quiz.bind(writer),current=()=>!entry.disposed&&box.isConnected&&guides.get(box)===entry;
  writer.quiz=async options=>{
   if(!current())return;
   // Keep the engine's queue order so a later Watch strokes request still wins.
   // Its queued quiz may start after disposal; cancel it as soon as loading settles.
   await quiz(options);
   if(!current())writer.cancelQuiz();
  };
  if(typeof ResizeObserver!=='undefined'){
   entry.observer=new ResizeObserver(()=>{
    if(!box.isConnected){disposeDetached();return;}
    const width=box.clientWidth,height=box.clientHeight||width;
    if(width>0&&height>0&&(width!==entry.width||height!==entry.height)){
     entry.width=width;entry.height=height;writer.updateDimensions({width,height});
    }
   });entry.observer.observe(box);
  }
  return writer;
 }
 document.addEventListener('appearancechange',()=>{
  disposeDetached();for(const [box,{writer}]of guides){
   // A failed loader can throw synchronously; isolate it from other visible guides.
   try{for(const [name,color]of Object.entries(palette(box)))writer.updateColor(name,color,{duration:0}).catch(()=>{});}catch{}
  }
 });
 new MutationObserver(disposeDetached).observe(document.documentElement,{childList:true,subtree:true});
 return {create};
})();
