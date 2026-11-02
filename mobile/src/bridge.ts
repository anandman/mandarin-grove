import {Capacitor,CapacitorHttp,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {createNativeFeedback,type FeedbackHttp,type FeedbackReceipt} from './feedback';
import {App} from '@capacitor/app';
import {installNativeTextSize,type TextSizePlugin} from './text-size';
import {installBundledNotices} from './navigation';
import {createAndroidBackController,installAudioLifecycle} from './lifecycle';
import {createNativeSpeech,type NativeSpeech,type SpeechPlugin} from './speech';
import {createRestoredFileMailbox,type RestoredFileResult} from './restored-files';
import {CapacitorSQLite,SQLiteConnection,type SQLiteDBConnection} from '@capacitor-community/sqlite';
import {createDatabase,inspectSchema,type SQLiteDriver,type NativeDatabase} from './database';
import {createRepository,type NativeRepository} from '../../adapters/native-storage.js';
import {files,type NativeFiles} from './files';

declare const __GROVE_INTERNAL_TESTS__:boolean;
declare const MAINLAND_AUDIO:{readings:Record<string,string>};
declare const REFERENCE_AUDIO:{readings:Record<string,string>};
type TestControl={phase:string|null;holdNextCommit(stage:'before'|'after'):void;releaseCommit():void;connection:SQLiteDBConnection;database?:NativeDatabase;feedbackRequest?:FeedbackHttp['request']};
declare global {
 interface Window {
  GrovePlatform:{platform:string;ready():Promise<void>;readonly persistenceReady:boolean;readonly repository:NativeRepository|undefined;recoveryRetention:boolean;readonly feedbackEpoch:number;prepareFeedback(report:unknown):Record<string,unknown>;sendFeedback(report:unknown,epoch:number):Promise<FeedbackReceipt>;speech:NativeSpeech;setBackHandler(handler:()=>boolean|Promise<boolean>):Promise<boolean>;readonly hasRestoredFileResult:boolean;takeRestoredFileResult():RestoredFileResult|undefined;files:NativeFiles;readonly installationId:string|undefined;exportRecovery():Promise<unknown>};
  GroveNativeTest?:TestControl;
  prepareWebProgress?(value:any,now:number,profile:any):any;
  showStorageFailure?(error:Error):void;
  stopSpeech?():void|Promise<void>;
  profileDialog(id:string,title:string):HTMLDialogElement;
 }
}
const platform=Capacitor.getPlatform(),sqlite=new SQLiteConnection(CapacitorSQLite);
// A missing text preference must never block durable offline practice.
if(platform==='ios')void installNativeTextSize(registerPlugin<TextSizePlugin>('GroveTextSize')).catch(()=>{});
const feedback=createNativeFeedback({request:options=>{
 // Synthetic test packages must never forward a live report, even if a fixture
 // forgot its mock. Ordinary packages omit this entire compile-time branch.
 if(__GROVE_INTERNAL_TESTS__&&options.method==='POST'){
  const mock=window.GroveNativeTest?.feedbackRequest;
  return mock?mock(options):Promise.reject(Error('test-send-disabled'));
 }
 return CapacitorHttp.request(options);
}},{platform,isPublicRecording:path=>{
 const catalogs=[typeof MAINLAND_AUDIO==='undefined'?undefined:MAINLAND_AUDIO.readings,typeof REFERENCE_AUDIO==='undefined'?undefined:REFERENCE_AUDIO.readings];
 return catalogs.some(c=>c&&Object.values(c).includes(path));
}});
installBundledNotices({createDialog:(id,title)=>window.profileDialog(id,title),stopSpeech:()=>window.stopSpeech?.()});
interface NativeSpeechPlugin extends SpeechPlugin {addListener(name:'interrupted',listener:()=>void):Promise<PluginListenerHandle>}
const speechPlugin=registerPlugin<NativeSpeechPlugin>('GroveSpeech');
const speech=createNativeSpeech(speechPlugin,{notify:()=>document.dispatchEvent(new Event('grove-native-voices-changed'))});
speech.setActive(false);
const audioReady=Promise.all([speechPlugin.stop({}),installAudioLifecycle(App,active=>{speech.setActive(active);if(!active)void window.stopSpeech?.();}),speechPlugin.addListener('interrupted',()=>document.dispatchEvent(new Event('grove-native-audio-interruption')))]);
void audioReady.catch(()=>{});
void speech.refresh();
const restoredFiles=createRestoredFileMailbox({notify:()=>document.dispatchEvent(new Event('grove-native-file-result'))});
const restoredReady=App.addListener('appRestoredResult',result=>{restoredFiles.accept(result);});
const backController=createAndroidBackController(App,error=>window.showStorageFailure?.(error instanceof Error?error:Error('Could not go back. Your saved progress was kept.')));
let repository:NativeRepository|undefined;
let installationId:string|undefined;
function driver(connection:SQLiteDBConnection):SQLiteDriver{
 if(!__GROVE_INTERNAL_TESTS__)return connection;
 let next:'before'|'after'|null=null,release:(()=>void)|undefined;
 const control:TestControl={phase:null,connection,holdNextCommit(stage){next=stage;control.phase=null;},releaseCommit(){release?.();}};
 window.GroveNativeTest=control;
 const pause=async(stage:'before'|'after')=>{if(next!==stage)return;next=null;control.phase=stage;await new Promise<void>(resolve=>release=resolve);control.phase=null;release=undefined;};
 return {
  execute:connection.execute.bind(connection),query:connection.query.bind(connection),run:connection.run.bind(connection),beginTransaction:connection.beginTransaction.bind(connection),rollbackTransaction:connection.rollbackTransaction.bind(connection),isTransactionActive:connection.isTransactionActive.bind(connection),
  commitTransaction:async()=>{await pause('before');const result=await connection.commitTransaction();await pause('after');return result;}
 };
}
const ready=(async()=>{
 try{
  if(!['ios','android'].includes(platform))throw Error('Open this package in the installed native app. Browser storage will not be used.');
  await restoredReady;await audioReady;
  installationId=(await files.installationIdentity()).id;
  await sqlite.checkConnectionsConsistency();
  if((await sqlite.isDatabase('mandarin_grove')).result){
   const probe=await sqlite.createConnection('mandarin_grove',false,'no-encryption',1,true);
   try{await probe.open();await inspectSchema(probe);}
   finally{await sqlite.closeConnection('mandarin_grove',true);}
  }
  const connection=await sqlite.createConnection('mandarin_grove',false,'no-encryption',1,false);await connection.open();
  const database=await createDatabase(driver(connection));
  if(__GROVE_INTERNAL_TESTS__&&window.GroveNativeTest)window.GroveNativeTest.database=database;
  const codec={
   decodeUtf8:(code:string)=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),char=>char.charCodeAt(0))),
   encodeUtf8:(text:string)=>{let bytes='';for(const byte of new TextEncoder().encode(text))bytes+=String.fromCharCode(byte);return btoa(bytes);}
  };
  repository=createRepository({database,codec,feedbackEpoch:()=>feedback.epoch,onEraseRequested:()=>feedback.invalidate(),beforeErase:async()=>{restoredFiles.invalidate();if(window.stopSpeech)await window.stopSpeech();else await speech.cancel();await files.clearTemporaryFiles();},migrate:(value,now,profile)=>{
   if(!window.prepareWebProgress)throw Error('The learner initialization is not ready. Existing data has been kept.');
   return window.prepareWebProgress(value,now,profile);
  }});
 }catch(error){throw error instanceof Error?error:Error(String(error));}
})();
// Startup observes ready; also handle a failure before the next script loads.
void ready.catch(()=>{});
window.GrovePlatform=Object.freeze({platform,ready:()=>ready,get persistenceReady(){return !!repository;},get repository(){return repository;},recoveryRetention:true,get feedbackEpoch(){return feedback.epoch;},prepareFeedback:feedback.prepare,async sendFeedback(report,epoch){const payload=feedback.prepare(report);await ready;return feedback.send(payload,epoch);},speech,setBackHandler:handler=>platform==='android'?backController.install(handler):Promise.resolve(false),get hasRestoredFileResult(){return restoredFiles.hasPending;},takeRestoredFileResult:()=>restoredFiles.take(),files,get installationId(){return installationId;},async exportRecovery(){
 await ready.catch(()=>{});
 if(repository){try{return await repository.exportRecovery();}catch{/* Preserve raw files when semantic recovery cannot read this schema. */}}
 // Close the owned connection before reading fixed DB/WAL/SHM paths. Never
 // open an empty database, reset a schema, or include identity/auth files.
 await sqlite.closeAllConnections();repository=undefined;return files.rawRecovery();
}});
