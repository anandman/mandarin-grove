// Import the complete, pinned CC-CEDICT release for Help; the word-checking bank stays unchanged.
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
function parseDictionary(text){
 const entries=[];
 for(const line of text.split(/\r?\n/)){
  if(!line||line.startsWith('#'))continue;
  const row=line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/);
  if(!row)throw Error('Unrecognized dictionary record');
  const [,traditional,simplified,pinyin,definitions]=row;
  entries.push([simplified,traditional===simplified?'':traditional,pinyin,definitions.split('/').join('; ')]);
 }
 return entries;
}
if(require.main===module){
 const input=process.argv[2];if(!input)throw Error('Pass the pinned CC-CEDICT .txt.gz file');
 const raw=fs.readFileSync(input),bytes=zlib.gunzipSync(raw),text=bytes.toString('utf8');
 if(!text.includes('Creative Commons Attribution-ShareAlike 4.0'))throw Error('Missing source license');
 const entries=parseDictionary(text),aliases={};
 for(const [s,t]of entries)if([...s].length===1&&[...t].length===1){const a=aliases[s]??=[];if(!a.includes(t))a.push(t);}
 const source={name:'CC-CEDICT',publisher:'MDBG and CC-CEDICT contributors',url:'https://www.mdbg.net/chinese/dictionary?page=cedict',download:'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',license:'CC-BY-SA-4.0',licenseURL:'https://creativecommons.org/licenses/by-sa/4.0/',retrieved:'2026-10-25',sha256:crypto.createHash('sha256').update(raw).digest('hex'),uncompressedSha256:crypto.createHash('sha256').update(bytes).digest('hex'),records:entries.length,changes:'All original records, headwords, readings and definitions retained. Simplified/traditional pairs represented as arrays, definition separators rendered as semicolons. General reference, not a teacher-reviewed school dictionary. Original word-checking bank unchanged.'};
 fs.writeFileSync('vendor/cc-cedict/dictionary.json',JSON.stringify({version:1,source,aliases,entries})+'\n');
 fs.writeFileSync('vendor/cc-cedict/DICTIONARY-SOURCE.json',JSON.stringify(source,null,2)+'\n');
 console.log(entries.length+' complete dictionary records imported');
}
module.exports={parseDictionary};
