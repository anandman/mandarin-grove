// Device appearance is independent of child progress. Apply before styles paint.
const APPEARANCE_KEY='zh_appearance';
const APPEARANCES=['system','light','dark'];
let appearance='system';
try{const saved=localStorage.getItem(APPEARANCE_KEY);if(APPEARANCES.includes(saved))appearance=saved;}catch{}
const appearanceMedia=window.matchMedia?.('(prefers-color-scheme: dark)');
function applyAppearance(){
 const mode=appearance==='system'?(appearanceMedia?.matches?'dark':'light'):appearance;
 document.documentElement.dataset.theme=mode;
 document.documentElement.style.colorScheme=mode;
 document.dispatchEvent(new Event('appearancechange'));
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='dark'?'#151916':'#F6F2E9');
 document.querySelectorAll('[data-appearance-setting]').forEach(el=>{el.value=appearance;});
 document.querySelectorAll('[name="appearance"]').forEach(el=>{el.checked=el.value===appearance;});
}
function setAppearance(value){
 if(!APPEARANCES.includes(value))return;
 appearance=value;applyAppearance();
 let message='Saved for this browser.';
 try{localStorage.setItem(APPEARANCE_KEY,value);}catch{message='Applied now. This browser could not save the preference. Please try again.';}
 document.querySelectorAll('#appearance-status').forEach(status=>status.textContent=message);
}
function appearanceSettingsMarkup(){
 return `<label class="voice-label" for="appearance-setting">Appearance</label><select id="appearance-setting" class="voice-choice" data-appearance-setting><option value="system" ${appearance==='system'?'selected':''}>System</option><option value="light" ${appearance==='light'?'selected':''}>Light</option><option value="dark" ${appearance==='dark'?'selected':''}>Dark</option></select><p class="reading-note">System follows this device’s light or dark setting.</p><p id="appearance-status" role="status" class="reading-note">Saved for this browser.</p>`;
}
function showAppearance(){
 if(document.getElementById('appearance-dialog'))return;
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.id='appearance-dialog';dialog.className='grove-dialog';dialog.setAttribute('aria-labelledby','appearance-title');
 dialog.innerHTML=`<form method="dialog"><button class="dialog-close" aria-label="Close appearance">✕</button></form><p class="grove-eyebrow">MAKE YOURSELF AT HOME</p><h2 id="appearance-title">Appearance</h2><p class="reading-note">Choose how your grove looks.</p><div class="appearance-options">${[['system','System','Follow this device'],['light','Light','Cream paper & charcoal ink'],['dark','Dark','Evening grove & warm light']].map(([value,label,description])=>`<label><input type="radio" name="appearance" value="${value}" ${appearance===value?'checked':''}><span><b>${label}</b><small>${description}</small></span><i class="appearance-swatch appearance-${value}" aria-hidden="true"></i></label>`).join('')}</div><p id="appearance-status" role="status" class="reading-note">Saved on this device. Your learning progress stays the same.</p>`;
 document.body.append(dialog);dialog.showModal();dialog.onclose=()=>{dialog.remove();previous?.focus();};
}
document.addEventListener('change',event=>{if(event.target.matches('[data-appearance-setting], [name="appearance"]'))setAppearance(event.target.value);});
window.addEventListener('storage',event=>{if(event.key===APPEARANCE_KEY){appearance=APPEARANCES.includes(event.newValue)?event.newValue:'system';applyAppearance();}});
if(appearanceMedia?.addEventListener)appearanceMedia.addEventListener('change',applyAppearance);else appearanceMedia?.addListener(applyAppearance);
applyAppearance();
