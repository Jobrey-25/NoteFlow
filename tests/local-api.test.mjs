import assert from 'node:assert/strict';
import { dispatch,emptyState,RequestError } from '../src/local-api.ts';
let state=emptyState(),calls=0;
// Match IndexedDB semantics: only commit a complete successful transaction.
function api(path,method='GET',body={}){const next=structuredClone(state);const result=structuredClone(dispatch(next,path,method,body));if(method!=='GET')state=next;calls++;return result;}
function rejects(path,method,body,status){const before=structuredClone(state);assert.throws(()=>api(path,method,body),e=>e instanceof RequestError&&e.status===status);assert.deepEqual(state,before,'Failed requests must not commit partial data.');calls++;}
const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Java café notes ☕'}]}]};
api('bootstrap','POST');api('bootstrap','POST');assert.equal(api('notes').total,1);
const workspace=api('workspace');const nb=api('notebooks','POST',{name:'Study',color:'violet'});
rejects('notebooks','POST',{name:' study '},409);rejects('notebooks/'+nb.id,'PATCH',{name:'Study',color:'invalid'},400);
let note=api('notes','POST',{title:'Java',content:doc,notebookId:nb.id});assert.match(note.plainText,/café/);
rejects('notes','POST',{title:'Invalid',content:{type:'doc',content:[{type:'text',text:'bad'}]}},400);
rejects('notes/'+note.id,'PATCH',{title:'Bad',expectedRevision:4},409);
note=api('notes/'+note.id,'PATCH',{title:'Java study',expectedRevision:0});assert.equal(note.revision,1);
rejects('notes/'+note.id,'PATCH',{title:'Changed',content:{type:'doc',content:[{type:'script'}]},expectedRevision:1},400);
assert.equal(api('notes/'+note.id).title,'Java study');
const tag=api('tags','POST',{name:'Exam'});note=api('notes/'+note.id+'/tags','PUT',{tagIds:[tag.id],expectedRevision:note.revision});
assert.equal(api('notes?tagId='+tag.id).total,1);assert.equal(api('notes?notebookId='+nb.id).total,1);assert.equal(api('notes?q=caf%C3%A9').total,1);assert.equal(api('notes?q=%25').total,0);
api('tags/'+tag.id,'PATCH',{name:'Revision'});assert.equal(api('notes/'+note.id).tags[0].name,'Revision');
note=api('notes/'+note.id,'PATCH',{isPinned:true,expectedRevision:note.revision});assert.equal(api('notes?pinned=true').total,1);
for(let i=0;i<55;i++)note=api('notes/'+note.id,'PATCH',{title:'Revision '+i,expectedRevision:note.revision});
let versions=api('notes/'+note.id+'/versions').versions;assert.equal(versions.length,50);
const version=api('notes/'+note.id+'/versions/'+versions.at(-1).id);note=api('notes/'+note.id+'/versions/'+version.id+'/restore','POST',{expectedRevision:note.revision});assert.equal(note.title,version.title);
note=api('notes/'+note.id,'PATCH',{isArchived:true,expectedRevision:note.revision});assert.equal(api('notes?state=archived').total,1);
note=api('notes/'+note.id+'/trash','POST',{expectedRevision:note.revision});assert.equal(api('notes?state=trash').total,1);
rejects('notes/'+note.id,'PATCH',{title:'No edit',expectedRevision:note.revision},400);
const backup=api('backup');assert.equal(backup.notes.length,2);assert.ok(backup.notes.find(n=>n.id===note.id).deletedAt);
const malformed=structuredClone(backup);malformed.notes[1].content={type:'doc',content:[{type:'script'}]};rejects('backup','POST',malformed,400);
const originalIds=new Set(state.notes.map(n=>n.id));const count=state.notes.length;
assert.equal(api('backup','POST',backup).imported,2);assert.equal(state.notes.length,count+2);assert.equal(state.notebooks.length,2);assert.equal(state.tags.length,1);assert.equal(state.notes.filter(n=>!originalIds.has(n.id)).length,2);
note=api('notes/'+note.id+'/restore','POST',{expectedRevision:note.revision});assert.equal(note.isArchived,true);
api('notebooks/'+nb.id,'DELETE');note=api('notes/'+note.id);assert.equal(note.notebookId,null);
api('tags/'+tag.id,'DELETE');note=api('notes/'+note.id);assert.equal(note.tags.length,0);
rejects('notes/'+note.id,'DELETE',{expectedRevision:note.revision},400);
note=api('notes/'+note.id+'/trash','POST',{expectedRevision:note.revision});api('notes/'+note.id,'DELETE',{expectedRevision:note.revision});rejects('notes/'+note.id,'GET',{},404);assert.ok(!state.versions.some(v=>v.noteId===note.id));
// Pagination and independent workspaces.
for(let i=0;i<34;i++)api('notes','POST',{title:'Page '+i});assert.equal(api('notes?size=30&page=0').notes.length,30);assert.ok(api('notes?size=30&page=1').notes.length>0);
const other=emptyState();dispatch(other,'bootstrap','POST');assert.equal(dispatch(other,'notes').total,1);assert.ok(!other.notes.some(n=>originalIds.has(n.id)));
console.log(`PASS: ${calls} browser data-layer operations: creation, search, tags, notebooks, stale revisions, atomic failures, lifecycle, history, backup restore, pagination and workspace isolation.`);
