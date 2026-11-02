const {openDriver}=require('./sqlite-driver.cjs'),{createDatabase}=require('../../mobile/src/database.ts'),Native=require('../../adapters/native-storage.js');
process.once('message',async({file,code,stage})=>{
 try{
  const driver=openDriver(file);let armed=false;
  const wrapped={...driver,commitTransaction:async()=>{
   if(armed&&stage==='before'){process.send({stage});await new Promise(()=>{});}
   const result=await driver.commitTransaction();
   if(armed&&stage==='after'){process.send({stage});await new Promise(()=>{});}
   return result;
  }};
  const database=await createDatabase(wrapped),codec={encodeUtf8:text=>Buffer.from(text).toString('base64'),decodeUtf8:value=>Buffer.from(value,'base64').toString('utf8')};
  const repository=Native.createRepository({database,codec});armed=true;await repository.importBackup(code);process.send({error:'Pause was not reached'});
 }catch(error){process.send({error:String(error)});process.exitCode=1;}
});
