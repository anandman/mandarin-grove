import {Capacitor} from '@capacitor/core';

type Writer={animateCharacter():Promise<void>};
declare global {
 interface Window {
  GrovePlatform:{platform:string;ready():Promise<void>;persistenceReady:boolean};
  HanziWriter:{create(element:HTMLElement,char:string,options:Record<string,unknown>):Writer};
 }
}
const ready=Promise.resolve();
window.GrovePlatform=Object.freeze({platform:Capacitor.getPlatform(),ready:()=>ready,persistenceReady:false});

// Internal L1 asset check only. The learner UI is enabled after transactional storage.
async function boot(){
 await window.GrovePlatform.ready();
 const main=document.getElementById('app')!;
 main.innerHTML='<h1>Native engineering check</h1><p class="reading-note">Packaged content check. Practice and saving are disabled in this internal build.</p><p id="native-platform"></p><div id="native-strokes" style="width:260px;height:260px;margin:16px auto"></div><button type="button" class="btn" id="native-watch">Watch 府 strokes</button> <button type="button" class="btn" id="native-audio">Play fǔ recording</button> <button type="button" class="btn" id="native-dictionary">Look up 学校 offline</button><p role="status" id="native-status"></p><p id="native-definition"></p>';
 document.getElementById('native-platform')!.textContent='Platform: '+window.GrovePlatform.platform;
 const report=(message:string)=>{document.getElementById('native-status')!.textContent=message;};
 const strokeResponse=await fetch('strokes/'+encodeURIComponent('府')+'.json');
 if(!strokeResponse.ok)throw Error('Bundled stroke data unavailable');
 const strokes=await strokeResponse.json();
 const writer=window.HanziWriter.create(document.getElementById('native-strokes')!,'府',{width:260,height:260,padding:14,strokeColor:'#1F2937',charDataLoader:(_char:string,loaded:(value:unknown)=>void)=>loaded(strokes)});
 document.getElementById('native-watch')!.onclick=()=>{void writer.animateCharacter().catch(()=>report('Could not animate the bundled strokes.'));};
 const audio=new Audio('audio/msu-fu3-mv3-dda17bab9e51.mp3');
 audio.onended=()=>report('Bundled fǔ recording finished.');audio.onerror=()=>report('Bundled recording could not play.');
 document.getElementById('native-audio')!.onclick=()=>{audio.currentTime=0;void audio.play().then(()=>report('Playing bundled fǔ recording.')).catch(()=>report('Bundled recording could not play.'));};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();});
 document.getElementById('native-dictionary')!.onclick=async()=>{
  try{
   const response=await fetch('vendor/cc-cedict/dictionary.json');if(!response.ok)throw Error('missing dictionary');
   const data=await response.json() as {entries:string[][]};const entry=data.entries.find(row=>row[0]==='学校');
   if(!entry)throw Error('missing entry');document.getElementById('native-definition')!.textContent=entry[0]+' · '+entry[2]+' · '+entry[3];report('Bundled dictionary loaded.');
  }catch{report('Bundled dictionary could not load.');}
 };
 report('Packaged content ready. Saving remains disabled.');
}
void boot().catch(()=>{document.getElementById('app')!.textContent='The native asset check could not start. Saving remains disabled.';});
