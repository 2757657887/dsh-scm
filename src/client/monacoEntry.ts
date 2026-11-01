import '../../node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/languages/definitions/python/register.js'
import 'monaco-editor/languages/definitions/javascript/register.js'
import 'monaco-editor/languages/definitions/typescript/register.js'
import 'monaco-editor/languages/definitions/cpp/register.js'
import 'monaco-editor/languages/definitions/markdown/register.js'
;(window as unknown as {__DshScmMonacoEnvironment:unknown}).__DshScmMonacoEnvironment={getWorkerUrl:()=>'/dsh-scm/assets/editor.worker.js'}
;(window as unknown as {__DshScmMonaco:unknown}).__DshScmMonaco=monaco

import 'monaco-editor/languages/definitions/xml/register.js'
import 'monaco-editor/languages/definitions/yaml/register.js'
import 'monaco-editor/languages/definitions/css/register.js'
import 'monaco-editor/languages/definitions/html/register.js'
import 'monaco-editor/languages/definitions/shell/register.js'