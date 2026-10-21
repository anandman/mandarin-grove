// Convert a pinned CC-CEDICT download to a local lookup bank. Never contacts a service.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
function parseCedict(text){
 const seen=new Set(),entries=[];
 for(const line of text.split(/\r?\n/)){
  const match=line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);if(!match)continue;
  const [,traditional,simplified,pinyin,definitions]=match;
  if(!/^\p{Script=Han}{2,8}$/u.test(simplified)||!/^\p{Script=Han}+$/u.test(traditional))continue;
  const meaning=definitions.split('/').filter(d=>!d.startsWith('CL:')).slice(0,2).join('; ').slice(0,160);
  const row=[simplified,traditional===simplified?'':traditional,pinyin,meaning],key=JSON.stringify(row);
  if(!seen.has(key)){seen.add(key);entries.push(row);}
 }
 return entries;
}
function characterAliases(text){
 const aliases={};
 for(const line of text.split(/\r?\n/)){const match=line.match(/^(\p{Script=Han}) (\p{Script=Han}) \[/u);if(match&&match[1]!==match[2]){const forms=aliases[match[2]]??=[];if(!forms.includes(match[1]))forms.push(match[1]);}}
 return aliases;
}
if(require.main===module){
 const input=process.argv[2];if(!input)throw Error('Usage: node scripts/build-word-bank.cjs /path/to/pinned-cedict.txt.gz');
 const compressed=fs.readFileSync(input),text=(input.endsWith('.gz')?zlib.gunzipSync(compressed):compressed).toString('utf8');
 if(!text.includes('Creative Commons Attribution-ShareAlike 4.0'))throw Error('Verify the source license before importing this snapshot');
 const source={name:'CC-CEDICT',publisher:'MDBG and CC-CEDICT contributors',url:'https://www.mdbg.net/chinese/dictionary?page=cc-cedict',download:'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',license:'CC-BY-SA-4.0',licenseURL:'https://creativecommons.org/licenses/by-sa/4.0/',retrieved:'2026-10-20',sha256:crypto.createHash('sha256').update(compressed).digest('hex'),changes:'Keep 2–8 Han-character headwords; retain simplified and traditional forms, pinyin and up to two non-classifier definitions (160 characters). Exact duplicate rows removed. Single-character traditional aliases kept for target recognition. Not a teacher-reviewed vocabulary list.'};
 const folder=path.join(__dirname,'../vendor/cc-cedict');fs.mkdirSync(folder,{recursive:true});
 const bank={version:1,source,aliases:characterAliases(text),entries:parseCedict(text)};
 fs.writeFileSync(path.join(folder,'words.json'),JSON.stringify(bank)+'\n');fs.writeFileSync(path.join(folder,'SOURCE.json'),JSON.stringify(source,null,2)+'\n');console.log(bank.entries.length+' dictionary rows written');
}
module.exports={parseCedict};
