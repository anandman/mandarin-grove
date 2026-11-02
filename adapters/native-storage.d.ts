import type {NativeDatabase} from '../mobile/src/database';
export interface NativeRepository {[method:string]:(...args:any[])=>Promise<any>}
export function createRepository(options:{
 database:NativeDatabase;
 codec:{encodeUtf8(text:string):string;decodeUtf8(code:string):string};
 migrate?:(value:any,now:number,profile:any)=>any;
 now?:()=>number;
 makeId?:()=>string;
 beforeErase?:()=>Promise<void>;
 feedbackEpoch?:()=>number;
 onEraseRequested?:()=>void;
}):NativeRepository;
