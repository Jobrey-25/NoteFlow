export type RichNode={type:string; text?:string; attrs?:Record<string,unknown>;marks?:{type:string;attrs?:Record<string,unknown>}[];content?:RichNode[]};
export const blankDocument:RichNode={type:'doc',content:[{type:'paragraph'}]};
const nodes=new Set(['doc','paragraph','text','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','codeBlock','hardBreak','horizontalRule']);
const marks=new Set(['bold','italic','strike','underline','code','link']);
export function validateDocument(input:unknown):{doc:RichNode;text:string}{
 let count=0;
 function visit(raw:unknown,depth:number):RichNode{
  if(depth>30||++count>20000||!raw||typeof raw!=='object')throw Error('Invalid document structure.');
  const n=raw as RichNode;if(!nodes.has(n.type))throw Error('Unsupported editor content.');
  const out:RichNode={type:n.type};
  if(n.type==='text'){if(typeof n.text!=='string')throw Error('Invalid text.');out.text=n.text;}
  if(n.attrs){const a:Record<string,unknown>={};if(n.type==='heading')a.level=[1,2,3].includes(Number(n.attrs.level))?Number(n.attrs.level):2;if(n.type==='taskItem')a.checked=n.attrs.checked===true;if(n.type==='orderedList')a.start=1;if(n.type==='codeBlock')a.language=null;out.attrs=a;}
  if(n.marks){if(!Array.isArray(n.marks)||n.marks.length>10)throw Error('Invalid text formatting.');out.marks=n.marks.filter(m=>marks.has(m.type)).map(m=>{if(m.type!=='link')return {type:m.type};const href=String(m.attrs?.href??'');if(!/^(https?:\/\/|mailto:)/i.test(href))throw Error('Links must start with https://, http:// or mailto:.');return {type:'link',attrs:{href,target:'_blank',rel:'noopener noreferrer'}};});}
  if(n.content){if(!Array.isArray(n.content))throw Error('Invalid document content.');out.content=n.content.map(c=>visit(c,depth+1));}
  const children=out.content??[];const block=['paragraph','heading','bulletList','orderedList','taskList','blockquote','codeBlock','horizontalRule'];
  const allowed:Record<string,string[]>={doc:block,paragraph:['text','hardBreak'],heading:['text','hardBreak'],bulletList:['listItem'],orderedList:['listItem'],taskList:['taskItem'],listItem:block,taskItem:block,blockquote:block,codeBlock:['text'],text:[],hardBreak:[],horizontalRule:[]};
  if(children.some(c=>!allowed[n.type].includes(c.type)))throw Error('Invalid nested editor content.');
  if(['bulletList','orderedList','taskList','listItem','taskItem','blockquote'].includes(n.type)&&!children.length)throw Error('Empty list or quote.');
  if(['listItem','taskItem'].includes(n.type)&&children[0]?.type!=='paragraph')throw Error('List items must start with a paragraph.');
  if(n.type!=='text'&&n.type!=='hardBreak'&&n.marks?.length)throw Error('Formatting must be applied to text.');
  return out;
 }
 const doc=visit(input,0);if(doc.type!=='doc')throw Error('Invalid document root.');const text=plainText(doc);if(text.length>100000||JSON.stringify(doc).length>900000)throw Error('This note is too long. Maximum 100,000 characters.');return {doc,text};
}
export function plainText(n:RichNode):string{if(n.type==='text')return n.text??'';if(n.type==='hardBreak')return '\n';const s=(n.content??[]).map(plainText).join('');return ['paragraph','heading','listItem','taskItem','codeBlock','blockquote'].includes(n.type)?s+'\n':s;}
export function paragraph(s:string):RichNode{return {type:'paragraph',content:s?[{type:'text',text:s}]:[]};}
export function starter(title:string,lines:string[]):RichNode{return {type:'doc',content:[...lines.map(paragraph)]};}
