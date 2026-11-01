/** Resolve DSH theme colors in the same DOM scope as the diff editor. */
export function editorTheme(host:HTMLElement) {
  function color(name:string,fallback:string) {
    const probe=document.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none';probe.style.color=`var(${name}, ${fallback})`;host.append(probe)
    const value=getComputedStyle(probe).color;probe.remove()
    const parts=value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/)
    return parts?('#'+parts.slice(1,4).map(v=>Math.max(0,Math.min(255,Math.round(Number(v)))).toString(16).padStart(2,'0')).join('')):fallback
  }
  const foreground=color('--dsw-alias-label-primary',getComputedStyle(host).color||'#cccccc')
  const secondary=color('--dsw-alias-label-tertiary','#888888')
  const brightness=foreground.startsWith('#')?(parseInt(foreground.slice(1,3),16)*.299+parseInt(foreground.slice(3,5),16)*.587+parseInt(foreground.slice(5,7),16)*.114):200
  return {base:brightness>128?'vs-dark':'vs',inherit:true,rules:[],colors:{'editor.background':'#00000000','editorGutter.background':'#00000000','editor.foreground':foreground,'editorLineNumber.foreground':secondary,'editorLineNumber.activeForeground':foreground}}
}
