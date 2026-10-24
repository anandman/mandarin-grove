// Independently authored profile and parent controls. Persistence stays behind the repository/wrappers.
function profileElement(tag,text,attributes={}){
 const element=document.createElement(tag);if(text!==undefined)element.textContent=text;
 for(const [name,value]of Object.entries(attributes))element.setAttribute(name,String(value));return element;
}
function profileStyles(){
 if(document.getElementById('profile-ui-style'))return;
 const style=profileElement('style',`.profile-setup,.profile-switcher{max-width:620px;margin:auto;text-align:center}.profile-animals{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:14px auto;max-width:430px}.profile-animals button{width:64px;height:64px;font-size:36px;border:2px solid var(--ln);border-radius:50%;background:var(--surface);color:var(--tx)}.profile-animals button[aria-pressed=true],.profile-grade button[aria-pressed=true]{border-color:var(--ac);background:var(--ac-soft)}.profile-grade{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:380px;margin:12px auto}.profile-grade button{min-height:48px;border:2px solid var(--ln);border-radius:14px;background:var(--surface);color:var(--tx)}.profile-input{box-sizing:border-box;width:100%;min-height:48px;padding:10px 12px;font-size:18px;border:1px solid var(--ln);border-radius:12px}.profile-setup .profile-input{max-width:360px}.profile-children{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.profile-child{display:grid;gap:8px;padding:18px 12px;min-height:160px;border:2px solid var(--ln);border-radius:20px;background:var(--surface);color:var(--tx);overflow-wrap:anywhere;font-size:20px}.profile-child>span:first-child{font-size:52px}.profile-panel{box-sizing:border-box;width:min(560px,100%);max-height:92dvh;margin:auto auto 0;padding:20px;border:1px solid var(--ln);border-radius:24px 24px 0 0;background:var(--bg);color:var(--tx);overflow:auto}.profile-panel::backdrop{background:#0009}.profile-panel.profile-delete{width:min(400px,calc(100vw - 24px));margin:auto;border-radius:22px}.profile-panel header{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:0;border:0;min-height:44px}.profile-panel h2{font-size:28px;margin:0}.profile-panel header button{width:44px;height:44px;font-size:23px;border-radius:50%}.profile-panel section{padding:16px;margin:14px 0;background:var(--surface);border:1px solid var(--ln);border-radius:16px;text-align:left}.profile-panel section h3{margin:0 0 12px}.profile-label{display:grid;gap:6px;font-size:15px;margin:12px 0}.profile-action{display:block;width:100%;margin:10px 0;min-height:48px;font-size:16px}.profile-panel .profile-grade{max-width:none}.profile-panel .profile-grade button{padding:8px}.profile-panel .profile-grade small{display:block;font-size:11px}.profile-child-row{display:flex;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--ln)}.profile-child-row>span{font-size:30px}.profile-child-row>div{flex:1;overflow-wrap:anywhere}.profile-child-row small{display:block;color:var(--mut)}.profile-child-row button{min-height:44px;border:1px solid var(--ln);border-radius:12px;background:var(--surface);color:var(--danger);padding:8px 12px}.profile-error{color:var(--danger);font-size:14px}.profile-notes{font-size:13px;color:var(--mut);line-height:1.6}.profile-panel details summary{min-height:44px;align-content:center;cursor:pointer}`,
 {id:'profile-ui-style'});document.head.append(style);
}
function profileFailure(container,error){
 let status=container.querySelector('.profile-error');if(!status){status=profileElement('p','',{class:'profile-error',role:'alert'});container.append(status);}status.textContent=error.message||String(error);
}
// Keep focused recovery controls visible below the dialog's sticky header.
function profileReveal(element){
 if(!element)return;
 if(!element.matches('button,input,textarea,select,a'))element.tabIndex=-1;
 element.focus({preventScroll:true});element.scrollIntoView({block:'center'});
 const dialog=element.closest('dialog'),header=dialog?.querySelector(':scope > header');
 if(header){const top=element.getBoundingClientRect().top,bottom=header.getBoundingClientRect().bottom+12;if(top<bottom)dialog.scrollTop-=bottom-top;}
}
function backupPreparationFailure(error){const status=document.getElementById('backup-status');if(status){status.textContent='Could not prepare a backup file. '+error.message+' Your saved progress is unchanged. Please try again.';profileReveal(status);}}
function profileRegistryRefresh(){PR=GROVE_REPOSITORY.readRegistry();GROVE_SAVED_REGISTRY=JSON.parse(JSON.stringify(PR));}
function profileGradeName(grade){return grade==='K'?'Kindergarten':'Grade '+grade;}
function profileClose(dialog){stopSpeech();if(dialog.open)dialog.close();dialog.remove();}
function profileButtonKeydown(event){
 if(event.repeat&&(event.key==='Enter'||event.key===' ')&&event.target.closest('button'))event.preventDefault();
}
function profileDialog(id,title,alert=false){
 document.getElementById(id)?.remove();profileStyles();const previous=document.activeElement;
 const dialog=profileElement('dialog',undefined,{id,class:'profile-panel'+(alert?' profile-delete':''),'aria-labelledby':id+'-title'});
 if(alert)dialog.setAttribute('role','alertdialog');
 const heading=profileElement('header'),name=profileElement('h2',title,{id:id+'-title'});heading.append(name);
 if(!alert){const close=profileElement('button','×',{'aria-label':'Close',type:'button'});close.onclick=()=>profileClose(dialog);heading.append(close);}dialog.append(heading);
 dialog.onkeydown=profileButtonKeydown;
 dialog.onclose=()=>{stopSpeech();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});};
 dialog.onclick=event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)profileClose(dialog);};
 return dialog;
}
function profileSection(parent,title,id){const section=profileElement('section',undefined,id?{id}:{});section.append(profileElement('h3',title));parent.append(section);return section;}
function profileButton(parent,text,id,action,secondary=false){const button=profileElement('button',text,{type:'button',class:'btn profile-action'+(secondary?' gray':''),...(id?{id}:{})});button.onclick=action;parent.append(button);return button;}
function profileInput(parent,label,id,value,type='text'){
 const wrapper=profileElement('label',label,{class:'profile-label',for:id}),input=profileElement('input',undefined,{id,type,class:'profile-input'});input.value=value||'';wrapper.append(input);parent.append(wrapper);return input;
}
function setup(first=false){
 screen();profileStyles();const homeButton=document.getElementById('home');if(homeButton)homeButton.style.display=first?'none':'inline-block';
 const view=profileElement('section',undefined,{class:'profile-setup'});view.append(profileElement('h1',first?'Welcome! 👋':'Add a kid'),profileElement('p',"Who's practicing Chinese?",{class:'mean'}));
 const input=profileInput(view,"Kid's name",'nm','');input.maxLength=16;input.placeholder="Kid's first name";
 const animals=['🐼','🦊','🐯','🐰','🐨','🦄','🐸','🐧','🐶','🐱','🐻','🐵','🐷','🐮','🐔','🐢','🐙','🐳','🦁','🐝','🦒','🐘','🦉','🦖'];let avatar=animals[PR.list.length%8],grade=null,createdId=null;
 view.append(profileElement('p','Pick an animal',{class:'mean'}));
 const primary=profileElement('div',undefined,{class:'profile-animals'}),more=profileElement('div',undefined,{id:'avm',class:'profile-animals'});more.hidden=true;
 animals.forEach((animal,index)=>{const button=profileElement('button',animal,{type:'button','data-av':animal,'aria-label':'Avatar '+animal,'aria-pressed':animal===avatar});button.onclick=()=>{avatar=animal;view.querySelectorAll('[data-av]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.av===avatar));};(index<8?primary:more).append(button);});view.append(primary,more);
 const toggle=profileButton(view,'More animals ▼','avt',()=>{more.hidden=!more.hidden;toggle.setAttribute('aria-expanded',String(!more.hidden));toggle.textContent=more.hidden?'More animals ▼':'Fewer animals ▲';},true);toggle.setAttribute('aria-controls','avm');toggle.setAttribute('aria-expanded','false');
 view.append(profileElement('p','Grade',{class:'mean'}));const grades=profileElement('div',undefined,{class:'profile-grade',role:'group','aria-label':'Grade'});view.append(grades);
 const start=profileButton(view,"Let's go ▶",'go',()=>{
  if(!grade)return;start.disabled=true;
  try{
   if(!createdId){const profile=GROVE_REPOSITORY.createProfile({name:input.value.trim().slice(0,16)||'Friend',av:avatar,gr:grade});createdId=profile.id;}
   profileRegistryRefresh();if(PR.cur!==createdId){PR.cur=createdId;savePR();}loadS();save();home();
  }catch(error){profileFailure(view,error);start.textContent=createdId?'Retry loading':'Try again';start.disabled=false;}
 });start.disabled=true;
 const hint=profileElement('p','Pick a grade first',{id:'gh',class:'reading-note',role:'status'});view.append(hint);
 for(const value of ['K','1','2','3','4','5']){const button=profileElement('button',value==='K'?'Kinder':ORD(value),{type:'button','data-gr':value,'aria-pressed':false});button.onclick=()=>{grade=value;grades.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===button));start.disabled=false;hint.textContent='';};grades.append(button);}
 A.replaceChildren(view);input.focus();
}
function who(){
 screen();profileStyles();const view=profileElement('section',undefined,{class:'profile-switcher'}),children=profileElement('div',undefined,{class:'profile-children'});view.append(profileElement('h1',"Who's practicing?"),children);
 for(const child of PR.list){const grade=child.gr||'2',button=profileElement('button',undefined,{type:'button',class:'profile-child','aria-label':(child.av||'🐼')+' '+(child.name||'Friend')+' '+ORD(grade)+', '+profileGradeName(grade)});button.append(profileElement('span',child.av||'🐼'),' ',profileElement('b',child.name||'Friend'),' ',profileElement('small',ORD(grade)));button.onclick=()=>{try{PR.cur=child.id;savePR();loadS();home();}catch(error){profileFailure(view,error);}};children.append(button);}
 const add=profileElement('button','＋ Add kid',{type:'button',class:'profile-child'});add.onclick=()=>setup(false);children.append(add);A.replaceChildren(view);
}
function parentEntry(button){
 if(document.getElementById('gov')||document.getElementById('parent-entry'))return;
 const dialog=profileDialog('parent-entry','Grown-ups settings');
 dialog.append(profileElement('p','These settings are for grown-ups. Continue to open them.',{class:'reading-note'}));
 const cancel=profileButton(dialog,'Cancel','parent-entry-cancel',()=>profileClose(dialog),true);
 profileButton(dialog,'Continue','parent-entry-continue',()=>{
  dialog.onclose=()=>{dialog.remove();if(button.isConnected){button.focus({preventScroll:true});grown();}};
  profileClose(dialog);
 });
 document.body.append(dialog);dialog.showModal();cancel.focus();
}
function parenthold(button){
 if(!button)return;let timer=null,holding=false;
 const cancel=()=>{clearTimeout(timer);timer=null;holding=false;button.style.background='';};
 const begin=event=>{if(holding)return;event.preventDefault();holding=true;button.style.background='var(--ac-soft)';timer=setTimeout(()=>{cancel();grown();},2000);};
 button.onpointerdown=begin;button.onpointerup=button.onpointercancel=button.onpointerleave=button.onblur=cancel;
 button.onkeydown=profileButtonKeydown;button.onkeyup=null;
 button.onclick=event=>{if(event.detail===0){cancel();parentEntry(button);}else if(!document.getElementById('gov'))pop('Hold for 2 seconds');};button.oncontextmenu=event=>event.preventDefault();
}
function gearHold(){parenthold(document.getElementById('gear'));}
function BKA(){
 try{const timestamp=Number(localStorage.getItem('zh_bk'));if(!Number.isFinite(timestamp)||timestamp<=0)return 'Never';const days=Math.max(0,Math.floor((Date.now()-timestamp)/86400000));return days===0?'Today':days===1?'Yesterday':days+' days ago';}catch{return 'Never';}
}
function BKW(profile,raw){
 const grade=profile?.gr||'2',label=profileGradeName(grade);
 try{const cfg=JSON.parse(raw)?.cfg;if(!cfg)return label;const units=QU(grade),quiz=units.find(([,chars])=>chars===cfg.quiz);if(quiz)return label+', Unit '+quiz[0];const selected=Array.isArray(cfg.set)?cfg.set:[];const last=selected[selected.length-1],unit=last&&units.find(([,chars])=>chars.includes(last));return unit?label+', Unit '+unit[0]:label;}catch{return label;}
}
function KASK(id){
 const child=PR.list.find(p=>p.id===id);if(!child||PR.list.length<2)return;
 const dialog=profileDialog('kdel','Delete '+child.name+'?',true);dialog.append(profileElement('p',child.av||'🐼',{style:'font-size:48px;text-align:center'}),profileElement('p',"This removes this child's stars and progress from this device. A saved backup can restore them later.",{class:'reading-note'}));
 const remove=profileButton(dialog,'Delete '+child.name,'kyes',()=>KDEL(id));remove.style.background='var(--danger-solid)';remove.style.color='var(--on-solid)';const cancel=profileButton(dialog,'Cancel','kno',()=>profileClose(dialog),true);document.body.append(dialog);dialog.showModal();cancel.focus();
}
function KDEL(id){
 const child=PR.list.find(p=>p.id===id);if(!child||PR.list.length<2)return;
 try{const deleted=GROVE_REPOSITORY.deleteProfile(id);if(!deleted)return;profileRegistryRefresh();loadS();document.getElementById('kdel')?.remove();document.getElementById('gov')?.remove();home();grown();pop(child.name+' deleted');}
 catch(error){profileFailure(document.getElementById('kdel')||document.getElementById('gov')||A,error);}
}
function grown(sectionName='child'){
 const child=PR.list.find(p=>p.id===PR.cur),childId=PR.cur,dialog=profileDialog('gov','⚙️ Grown-ups');
 const current=()=>{if(PR.cur===childId)return true;profileFailure(dialog,new Error('The active child changed. Close settings and open them again.'));return false;};
 if(child){
  const section=profileSection(dialog,(child.name||'Friend')+"'s settings",'child-settings'),name=profileInput(section,"Kid's name",'gn',child.name),grade=profileElement('input',undefined,{id:'ggr',type:'hidden'});grade.value=GR();section.append(grade);
  const grades=profileElement('div',undefined,{class:'profile-grade grg',role:'group','aria-label':'Grade'});section.append(profileElement('p','Grade'),grades);
  for(const value of ['K','1','2','3','4','5']){const button=profileElement('button',undefined,{type:'button','data-grade':value,'aria-pressed':value===GR()});const count=gList(value).length;button.append(profileElement('b',value),profileElement('small',count+' characters'));button.onclick=()=>{grade.value=value;QSW(value);grades.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===button));};grades.append(button);}
  section.append(profileElement('p','Name, grade, test date and quiz-character edits use Save below. Closing without Save leaves those fields unchanged.',{id:'child-save-note',class:'profile-notes'}));
  section.append(profileElement('p','Each grade remembers its selected characters. Quiz units follow the school character list.',{class:'profile-notes'}));
  const date=profileInput(section,'Next test date (leave empty to hide the countdown)','gt',S.cfg.test,'date');
  const unitLabel=profileElement('label','Next quiz',{id:'gul',class:'profile-label',for:'gu'}),units=profileElement('select',undefined,{id:'gu',class:'profile-input'});units.innerHTML=QOPT(GR());unitLabel.append(units);unitLabel.style.display=QU(GR()).length?'':'none';section.append(unitLabel);
  if(S.cfg.quiz){profileButton(section,'✓ '+child.name+' took this quiz. Move to the next one.','gtook',()=>{
   if(!current())return;try{const quiz=S.cfg.quiz,past=Array.isArray(S.cfg.past)?S.cfg.past:[],old=past.find(row=>row.q===quiz)||{};S.cfg.past=[{...old,q:quiz,d:S.cfg.test||''},...past.filter(row=>row.q!==quiz)];S.cfg.quiz=NXT(quiz);S.cfg.test='';save();profileClose(dialog);home();pop('Quiz recorded');}catch(error){profileFailure(dialog,error);}
  },true);section.append(profileElement('p','Recording a completed quiz saves immediately and moves to the next quiz.',{id:'quiz-save-note',class:'profile-notes'}));}
  const quiz=profileInput(section,'Quiz characters','gq',S.cfg.quiz);quiz.placeholder='e.g. 买卖进常出';units.onchange=()=>{if(units.value)quiz.value=units.value;};
  profileButton(section,'Save','gsave',()=>{
   if(!current())return;try{const oldGrade=GR(),newGrade=grade.value,cfg={...S.cfg,test:date.value,quiz:quiz.value.replace(/[\s,，、]/g,'')};
    if(newGrade!==oldGrade){cfg.sets={...(S.cfg.sets||{}),[oldGrade]:Array.isArray(S.cfg.set)?S.cfg.set.slice():null};cfg.set=Array.isArray(cfg.sets[newGrade])?cfg.sets[newGrade].slice():null;}
    const registry=JSON.parse(JSON.stringify(PR)),target=registry.list.find(p=>p.id===childId);if(!target)throw new Error('This child is no longer available. Reload before saving.');target.name=name.value.trim()||target.name;target.gr=newGrade;const candidate=JSON.parse(JSON.stringify(S));candidate.cfg=cfg;saveProfileSettings(registry,candidate);setCards();lq=[];mq=[];profileClose(dialog);home();pop('Saved');
   }catch(error){profileFailure(dialog,error);}
  });
 }
 profileButton(dialog,'Parent dashboard',null,()=>{profileClose(dialog);parentDashboard();});profileButton(dialog,'Feedback / saved reports',null,()=>{profileClose(dialog);showFeedback();},true);
 dialog.append(profileElement('p','App version: '+(typeof VER==='undefined'?'loading':VER),{class:'profile-notes'}));
 const deviceSection=profileSection(dialog,'Device settings','device-settings');deviceSection.append(profileElement('p','Appearance and pronunciation choices save immediately on this device. They are separate from the child’s Save button.',{class:'profile-notes'}));
 const appearanceSection=profileSection(deviceSection,'Appearance','appearance-settings');appearanceSection.insertAdjacentHTML('beforeend',appearanceSettingsMarkup());
 const voiceSection=profileSection(deviceSection,'Pronunciation','voice-settings');voiceSection.insertAdjacentHTML('beforeend',voiceSettingsMarkup());
 // Summary reads must not refresh the repository's registry/progress merge baselines.
 const children=profileSection(dialog,'Kids','gkids');
 for(const item of PR.list){const row=profileElement('div',undefined,{class:'profile-child-row'}),text=profileElement('div'),title=profileElement('b',(item.name||'Friend')+(item.id===PR.cur?' · Playing now':''));text.append(title);let count='';try{const saved=JSON.parse(localStorage.getItem('zh_p_'+item.id)||'null');if(!saved)throw new Error('Missing saved profile');count=' · '+Object.values(saved.pts||{}).filter(n=>n>=5).length+' character stars';}catch{count=' · Saved progress unavailable';}text.append(profileElement('small',profileGradeName(item.gr||'2')+count));row.append(profileElement('span',item.av||'🐼'),text);
  if(PR.list.length>1){const remove=profileElement('button','Delete',{type:'button','aria-label':'Delete '+item.name});remove.onclick=()=>KASK(item.id);row.append(remove);}children.append(row);
 }
 if(PR.list.length===1)children.append(profileElement('p','Keep at least one kid on this device.',{class:'profile-notes'}));
 const transfers=profileSection(dialog,'Backup','backup-settings');transfers.append(profileElement('p',"Save every child's progress in one private code or file. Backups include names; keep them somewhere safe.",{class:'profile-notes'}),profileElement('p','Last copied: '+BKA(),{id:'glast'}));
 const copy=profileButton(transfers,'','gcopy',async()=>{
  let code;try{code=backup();if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(code);if(!dialog.isConnected)return;try{localStorage.setItem('zh_bk',String(Date.now()));}catch{}document.getElementById('glast').textContent='Last copied: '+BKA();document.getElementById('gcl').textContent='Copied! Paste it somewhere safe.';document.getElementById('gcf').replaceChildren();}
  catch(error){if(dialog.isConnected){if(code!==undefined)backupCopyFallback(code);else profileFailure(transfers,error);}}
 },true);copy.append(profileElement('span','Copy backup code',{id:'gcl'}));transfers.append(profileElement('div',undefined,{id:'gcf'}));
 const download=profileButton(transfers,'Download backup file','gdownload',()=>{try{downloadBackupFile();}catch(error){backupPreparationFailure(error);}},true);download.setAttribute('aria-label','Download backup file');
 const file=profileElement('input',undefined,{id:'gfile',type:'file',accept:'.txt,text/plain','aria-label':'Choose backup file'});file.hidden=true;file.onchange=()=>restoreBackupFile(file);
 const load=profileButton(transfers,'Restore from backup file','gload',()=>file.click(),true);load.setAttribute('aria-label','Restore from backup file');transfers.append(file,profileElement('p','',{id:'backup-status',role:'status',class:'reading-note'}));
 profileButton(transfers,'Restore from a backup code','grest',()=>openBackupRestore(dialog),true);transfers.append(profileElement('div',undefined,{id:'grx'}));
 const maintenance=profileSection(dialog,'Fix & reset','maintenance-settings');maintenance.append(profileElement('p','Save a backup before resetting or erasing progress.',{class:'profile-notes'}));
 profileButton(maintenance,'Refresh app','gref',async()=>{try{if(window.caches)for(const key of await caches.keys())await caches.delete(key);if(navigator.serviceWorker)for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();}catch{}location.replace(location.pathname+'?v='+Date.now());},true);
 if(child)profileButton(maintenance,'Reset '+child.name+"'s progress",'grk',()=>{if(!current()||!confirm('Reset all of '+child.name+"'s stars and progress? This cannot be undone. Saved settings stay. Make a backup first if you may need them."))return;try{const cfg=JSON.parse(JSON.stringify(S.cfg));S=blank();S.cfg=cfg;save();profileClose(dialog);home();}catch(error){profileFailure(dialog,error);}},true);
 const erase=profileButton(maintenance,'Erase everything on this device','gerase',()=>{if(prompt('Delete every child and all progress on this device? Type ERASE to confirm. Save a backup first if you may need it.')!=='ERASE')return;try{for(const key of Object.keys(localStorage))if(key.startsWith('zh_')||key==='owenzh_v1')localStorage.removeItem(key);location.replace(location.pathname);}catch(error){profileFailure(dialog,error);}},true);erase.style.color='var(--danger)';
 if(typeof NOTES!=='undefined'&&Array.isArray(NOTES)){const news=profileSection(dialog,"What's new");for(const entry of NOTES){if(!Array.isArray(entry))continue;news.append(profileElement('p',entry[0]+' · '+entry[1],{class:'profile-notes'}));}}
 const credits=profileSection(dialog,'About & credits','about-settings');credits.append(profileElement('p','Mandarin Grove practices Putonghua and simplified Chinese. Progress stays in this browser. Device voices may use the device speech service.',{class:'profile-notes'}));
 const notices=profileElement('a','Third-party source and license notices',{href:'vendor/SOURCE-NOTICES.md',target:'_blank',rel:'noopener'});credits.append(notices);
 const navigation=profileElement('nav',undefined,{'aria-label':'Grown-ups sections',class:'parent-section-nav'});
 const destinations={child:'child-settings',device:'device-settings',kids:'gkids',backup:'backup-settings',maintenance:'maintenance-settings',about:'about-settings'};
 const jump=(key)=>{const section=dialog.querySelector('#'+destinations[key]);if(!section)return;section.tabIndex=-1;section.scrollIntoView({block:'start'});section.focus({preventScroll:true});};
 for(const [key,label]of [['child','Child'],['device','Device'],['kids','Kids'],['backup','Backup'],['maintenance','Fix & reset'],['about','About']])if(key!=='child'||child){const button=profileElement('button',label,{type:'button'});button.onclick=()=>jump(key);navigation.append(button);}
 dialog.querySelector('header').append(navigation);document.body.append(dialog);dialog.showModal();bindVoiceSettings();dialog.querySelector('[aria-label="Close"]').focus();
 if(sectionName!=='child')jump(sectionName);
}
