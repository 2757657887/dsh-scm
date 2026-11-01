import {createElement} from 'react';import {createRoot} from 'react-dom/client';import {ScmPanel} from '../src/client/panel.ts';
createRoot(document.getElementById('app')).render(createElement(ScmPanel,{sessionId:'preview'}));
