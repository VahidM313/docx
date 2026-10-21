$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public class WB {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
}
'@
function Snap($f) { bun scripts/cdp-hover.ts 9223 9999,9999 200 $f | Out-Null }
# paint liveness probe: red outline via DOM, then screenshot
bun scripts/cdp-eval.ts 9223 "document.documentElement.style.outline='6px solid red';'painted'"
Snap _p1-red.png
Start-Sleep -Milliseconds 1500
Snap _p2-red.png
# now move the real cursor to the rail strip and see if the panel opens (screenshot) + DOM check
[WB]::SetCursorPos(20, 400) | Out-Null
Start-Sleep -Milliseconds 1800
Snap _p3-railhover.png
bun scripts/cdp-eval.ts 9223 --file _overlay-dump.js
bun scripts/cdp-eval.ts 9223 "document.documentElement.style.outline='';'cleaned'"
