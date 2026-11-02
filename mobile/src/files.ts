import {registerPlugin} from '@capacitor/core';

export interface NativeFiles {
 saveText(options:{name:string;text:string;mimeType:string}):Promise<{saved:boolean}>;
 saveFeedback(options:{text:string}):Promise<{saved:boolean}>;
 shareFeedback(options:{text:string}):Promise<{closed:true}>;
 openText():Promise<{cancelled:true}|{cancelled:false;text:string}>;
 installationIdentity():Promise<{id:string}>;
 rawRecovery():Promise<{format:string;files:Array<{name:string;base64:string;sha256:string}>}>;
 clearTemporaryFiles():Promise<void>;
}
// Only OS-selected document URIs and fixed app-private recovery paths are used.
// There is no arbitrary filesystem path or persistent directory permission API.
export const files=registerPlugin<NativeFiles>('GroveFiles');
