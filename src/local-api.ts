import { blankDocument, paragraph, plainText, validateDocument, type RichNode } from './lib/document.ts';
export type Tag={id:string;name:string};
export type Notebook={id:string;name:string;color:string};
export type Note={id:string;title:string;content:RichNode;plainText:string;notebookId:string|null;icon:string;isPinned:boolean;isArchived:boolean;deletedAt:string|null;revision:number;createdAt:string;updatedAt:string;tags:Tag[]};
type Version={id:string;noteId:string;revision:number;title:string;content:RichNode;created_at:string};
export type State={initialized:boolean;notes:Note[];notebooks:Notebook[];tags:Tag[];versions:Version[]};
export const emptyState=():State=>({initialized:false,notes:[],notebooks:[],tags:[],versions:[]});
export class RequestError extends Error{constructor(message:string,public status=400,public code='ERROR'){super(message);}}
const fail=(message:string,status=400,code='ERROR'):never=>{throw new RequestError(message,status,code);};
const timestamp=()=>new Date().toISOString();
const colours=['green','amber','blue','rose','violet'];
function checkedName(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(`Enter a name between 1 and ${max} characters.`);return (value as string).trim();}
function documentContent(value:unknown){try{return validateDocument(value);}catch(e){return fail((e as Error).message);}}
function makeNote(b:any,s:State):Note{
 if(b.notebookId&&!s.notebooks.some(n=>n.id===b.notebookId))fail('Notebook not found.',404);
 const title=b.title??'';if(typeof title!=='string'||title.length>200)fail('Titles can have up to 200 characters.');
 const {doc,text}=documentContent(b.content??blankDocument);const now=timestamp();
 return {id:crypto.randomUUID(),title,content:doc,plainText:text,notebookId:b.notebookId??null,icon:'note',isPinned:false,isArchived:false,deletedAt:null,revision:0,createdAt:now,updatedAt:now,tags:[]};
}
/** Synchronous mutation reducer. IndexedDB commits its result atomically in one read/write transaction. */
export function dispatch(s:State,path:string,method='GET',b:any={}):any{
 const url=new URL(path,'https://local.invalid/'),parts=url.pathname.replace(/^\//,'').split('/');
 if(parts[0]==='bootstrap'&&method==='POST'){
  if(!s.initialized){const nb={id:crypto.randomUUID(),name:'Personal',color:'green'};s.notebooks.push(nb);s.notes.push(makeNote({title:'Welcome to NoteFlow',notebookId:nb.id,content:{type:'doc',content:[paragraph('A little room for your ideas.'),paragraph('Create a note, organise it in notebooks, and add tags to find it later.'),paragraph('This GitHub Pages edition saves notes only in this browser. It does not use a login or sync between devices. Use Import & backup to keep a copy or move notes to another device.')]}},s));s.initialized=true;}return {ok:true};
 }
 if(parts[0]==='workspace'&&method==='GET'){
  const active=s.notes.filter(n=>!n.deletedAt&&!n.isArchived);
  return {counts:{active:active.length,pinned:active.filter(n=>n.isPinned).length,unfiled:active.filter(n=>!n.notebookId).length,archived:s.notes.filter(n=>!n.deletedAt&&n.isArchived).length,trash:s.notes.filter(n=>n.deletedAt).length},notebooks:[...s.notebooks].sort((a,b)=>a.name.localeCompare(b.name)).map(n=>({...n,count:active.filter(note=>note.notebookId===n.id).length})),tags:[...s.tags].sort((a,b)=>a.name.localeCompare(b.name))};
 }
 if(parts[0]==='backup'){
  if(method==='GET')return {format:'noteflow-backup',version:1,exportedAt:timestamp(),notebooks:s.notebooks,tags:s.tags,notes:s.notes};
  if(method==='POST')return restoreBackup(s,b);
 }
 if(parts[0]==='notebooks'||parts[0]==='tags'){
  const isNotebook=parts[0]==='notebooks',collection=isNotebook?s.notebooks:s.tags;
  if(method==='GET')return {[parts[0]]:collection};
  if(method==='POST'){
   const name=checkedName(b.name,isNotebook?80:40);if(collection.some(n=>n.name.toLocaleLowerCase()===name.toLocaleLowerCase()))fail('That name is already in use.',409,'DUPLICATE');
   const item={id:crypto.randomUUID(),name,...(isNotebook?{color:colours.includes(b.color)?b.color:'green'}:{})};collection.push(item as Notebook);return item;
  }
  const item=collection.find(n=>n.id===parts[1]);if(!item)fail('Not found.',404);
  if(method==='PATCH'){
   const name=checkedName(b.name,isNotebook?80:40);if(collection.some(n=>n.id!==item!.id&&n.name.toLocaleLowerCase()===name.toLocaleLowerCase()))fail('That name is already in use.',409,'DUPLICATE');
   if(isNotebook&&b.color!==undefined&&!colours.includes(b.color))fail('Invalid notebook colour.');
   item!.name=name;if(isNotebook&&b.color!==undefined)(item as Notebook).color=b.color;
   if(!isNotebook)for(const note of s.notes)for(const tag of note.tags)if(tag.id===item!.id)tag.name=name;
   return {ok:true};
  }
  if(method==='DELETE'){
   for(const note of s.notes){if(isNotebook&&note.notebookId===item!.id){note.notebookId=null;note.revision++;note.updatedAt=timestamp();}else if(!isNotebook&&note.tags.some(t=>t.id===item!.id)){note.tags=note.tags.filter(t=>t.id!==item!.id);note.revision++;note.updatedAt=timestamp();}}
   if(isNotebook)s.notebooks=s.notebooks.filter(n=>n.id!==item!.id);else s.tags=s.tags.filter(t=>t.id!==item!.id);return {ok:true};
  }
 }
 if(parts[0]==='notes'&&!parts[1]){
  if(method==='POST'){const n=makeNote(b,s);s.notes.push(n);return n;}
  if(method==='GET'){
   const state=url.searchParams.get('state')??'active',q=(url.searchParams.get('q')??'').toLocaleLowerCase(),nb=url.searchParams.get('notebookId'),tag=url.searchParams.get('tagId');
   let notes=s.notes.filter(n=>(state==='trash'?!!n.deletedAt:!n.deletedAt&&(state==='archived'?n.isArchived:!n.isArchived))&&(!q||(n.title+'\n'+n.plainText).toLocaleLowerCase().includes(q))&&(!nb||(nb==='unfiled'?!n.notebookId:n.notebookId===nb))&&(!tag||n.tags.some(t=>t.id===tag))&&(url.searchParams.get('pinned')!=='true'||n.isPinned));
   const sort=url.searchParams.get('sort');notes.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title)||a.id.localeCompare(b.id):sort==='oldest'?a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id):Number(b.isPinned)-Number(a.isPinned)||b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id));
   const size=Math.max(1,Math.min(100,Math.floor(Number(url.searchParams.get('size'))||30))),page=Math.max(0,Math.floor(Number(url.searchParams.get('page'))||0));return {notes:notes.slice(page*size,(page+1)*size),total:notes.length,page,size};
  }
 }
 if(parts[0]==='notes'&&parts[1]){
  const n=s.notes.find(n=>n.id===parts[1]);if(!n)return fail('Note not found.',404);
  if(parts[2]==='versions'&&method==='GET'){const versions=s.versions.filter(v=>v.noteId===n.id);if(parts[3])return versions.find(v=>v.id===parts[3])??fail('Version not found.',404);return {versions:versions.sort((a,b)=>b.revision-a.revision)};}
  if(method==='GET'&&parts.length===2)return n;
  if(!Number.isSafeInteger(b.expectedRevision))fail('A revision is required.');if(b.expectedRevision!==n.revision)fail('This note changed in another tab. Your draft is still here.',409,'CONFLICT');
  if(method==='DELETE'&&parts.length===2){if(!n.deletedAt)fail('Move this note to Trash first.');s.notes=s.notes.filter(note=>note.id!==n.id);s.versions=s.versions.filter(v=>v.noteId!==n.id);return {ok:true};}
  let contentChanged=false;
  if(parts[2]==='trash'&&method==='POST')n.deletedAt=timestamp();
  else if(parts[2]==='restore'&&method==='POST')n.deletedAt=null;
  else if(n.deletedAt)fail('Restore this note before editing.');
  else if(parts[2]==='versions'&&parts[4]==='restore'&&method==='POST'){
   const v=s.versions.find(v=>v.noteId===n.id&&v.id===parts[3]);if(!v)fail('Version not found.',404);n.title=v!.title;n.content=structuredClone(v!.content);n.plainText=plainText(n.content);contentChanged=true;
  }else if(parts[2]==='tags'&&method==='PUT'){
   if(!Array.isArray(b.tagIds)||b.tagIds.length>30)fail('Choose at most 30 tags.');const ids=[...new Set(b.tagIds)];const tags=ids.map(id=>s.tags.find(t=>t.id===id));if(tags.some(t=>!t))fail('Tag not found.',404);n.tags=structuredClone(tags as Tag[]);
  }else if(method==='PATCH'&&parts.length===2){
   if(Object.keys(b).some(k=>!['expectedRevision','title','content','notebookId','icon','isPinned','isArchived'].includes(k)))fail('Unsupported note field.');
   if(b.title!==undefined){if(typeof b.title!=='string'||b.title.length>200)fail('Titles can have up to 200 characters.');n.title=b.title;contentChanged=true;}
   if(b.content!==undefined){const {doc,text}=documentContent(b.content);n.content=doc;n.plainText=text;contentChanged=true;}
   if(b.notebookId!==undefined){if(b.notebookId!==null&&!s.notebooks.some(nb=>nb.id===b.notebookId))fail('Notebook not found.',404);n.notebookId=b.notebookId;}
   if(b.icon!==undefined){if(!['note','sparkles','lightbulb','calendar','book','coffee'].includes(b.icon))fail('Invalid icon.');n.icon=b.icon;}
   for(const key of ['isPinned','isArchived'] as const)if(b[key]!==undefined){if(typeof b[key]!=='boolean')fail('Invalid state.');n[key]=b[key];}
  }else fail('Operation not found.',404);
  n.revision++;n.updatedAt=timestamp();if(contentChanged){s.versions.push({id:crypto.randomUUID(),noteId:n.id,title:n.title,content:structuredClone(n.content),revision:n.revision,created_at:n.updatedAt});const keep=new Set(s.versions.filter(v=>v.noteId===n.id).sort((a,b)=>b.revision-a.revision).slice(0,50).map(v=>v.id));s.versions=s.versions.filter(v=>v.noteId!==n.id||keep.has(v.id));}return n;
 }
 return fail('Operation not found.',404);
}
function restoreBackup(s:State,b:any){
 if(!b||typeof b!=='object'||b.format!=='noteflow-backup'||b.version!==1||!Array.isArray(b.notes)||!Array.isArray(b.notebooks)||!Array.isArray(b.tags))fail('Choose a valid NoteFlow JSON backup.');
 if(b.notes.length>2000||b.notebooks.length>500||b.tags.length>1000)fail('This backup exceeds the import limits (2,000 notes, 500 notebooks, 1,000 tags).');
 const notebookMap=new Map<string,string>(),tagMap=new Map<string,Tag>();
 for(const nb of b.notebooks){const name=checkedName(nb.name,80);let dest=s.notebooks.find(n=>n.name.toLocaleLowerCase()===name.toLocaleLowerCase());if(!dest){dest={id:crypto.randomUUID(),name,color:colours.includes(nb.color)?nb.color:'green'};s.notebooks.push(dest);}notebookMap.set(nb.id,dest.id);}
 for(const tag of b.tags){const name=checkedName(tag.name,40);let dest=s.tags.find(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase());if(!dest){dest={id:crypto.randomUUID(),name};s.tags.push(dest);}tagMap.set(tag.id,dest);}
 for(const old of b.notes){
  if(!old||typeof old!=='object')fail('Invalid note in backup.');
  const notebookId=old.notebookId?notebookMap.get(old.notebookId):null;if(old.notebookId&&!notebookId)fail('A backup note references a missing notebook.');
  const n=makeNote({title:old.title,content:old.content,notebookId},s);n.isPinned=old.isPinned===true;n.isArchived=old.isArchived===true;
  n.deletedAt=old.deletedAt?timestamp():null;n.icon=['note','sparkles','lightbulb','calendar','book','coffee'].includes(old.icon)?old.icon:'note';
  if(!Array.isArray(old.tags)||old.tags.length>30)fail('Invalid backup tags.');
  n.tags=old.tags.map((t:any)=>{const tag=tagMap.get(t.id);if(!tag)fail('A backup note references a missing tag.');return {...tag!};});
  if(typeof old.createdAt==='string'&&Number.isFinite(Date.parse(old.createdAt)))n.createdAt=old.createdAt;
  s.notes.push(n);
 }
 s.initialized=true;return {ok:true,imported:b.notes.length};
}
let database:Promise<IDBDatabase>|undefined;
function openDatabase(){
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new RequestError('This browser does not support note storage.'));return;}
  const scope=new URL('.',document.baseURI).pathname;
  const request=indexedDB.open('noteflow:'+scope,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
  request.onerror=()=>{database=undefined;reject(new RequestError('Could not open device storage. Allow site storage and try again.'));};
  request.onblocked=()=>{database=undefined;reject(new RequestError('Close other NoteFlow tabs and try again.'));};
 });return database;
}
/** Read/write transactions serialize competing tabs and preserve revision checks. */
export async function localApi(path:string,method='GET',body:any={}):Promise<any>{
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('workspace',method==='GET'?'readonly':'readwrite'),store=tx.objectStore('workspace'),request=store.get('data');let result:any,error:unknown;
  request.onsuccess=()=>{try{const state=request.result??emptyState();result=dispatch(state,path,method,body);if(method!=='GET')store.put(state,'data');}catch(e){error=e;tx.abort();}};
  tx.oncomplete=()=>resolve(structuredClone(result));
  tx.onabort=tx.onerror=()=>reject(error??new RequestError('Device storage could not save your changes. Free some space, export your draft, and retry.'));
 });
}
