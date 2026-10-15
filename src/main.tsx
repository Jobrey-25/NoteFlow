import React from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from './workspace';
import './globals.css';
const scope=new URL('.',document.baseURI).pathname;
createRoot(document.getElementById('root')!).render(<Workspace user={{id:'local:'+scope,name:'My notes',email:'Stored on this device · No account required'}} signOutPath="#"/>);
