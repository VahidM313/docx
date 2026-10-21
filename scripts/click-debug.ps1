/** Attach click logger, real-click targets, dump what arrived. */
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W2 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
}'
function Go($x, $y, $ms = 800) { [W2]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds $ms }
function Click($x, $y) { Go $x $y 500; [W2]::mouse_event(2,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 80; [W2]::mouse_event(4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 700 }

bun scripts/cdp-eval.ts 9223 "window.__c=[];document.addEventListener('click',e=>(window.__c=window.__c||[]).push((e.target.tagName||'?')+'|'+String(e.target.textContent||'').slice(0,20)+'|'+e.clientX+','+e.clientY),true);document.addEventListener('pointerdown',e=>(window.__c=window.__c||[]).push('PD|'+e.clientX+','+e.clientY),true);'logger on'"

# A) hub card Open button (no panel involved)
Click 242 455
bun scripts/cdp-eval.ts 9223 "JSON.stringify(window.__c);window.__c=[]"

# B) sidebar panel row: hover rail first, then click Bookmarks row
Go 20 300 1100
Click 70 104
bun scripts/cdp-eval.ts 9223 "JSON.stringify(window.__c)"
