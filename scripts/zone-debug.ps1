$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public class WD {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
}
'@
[WD]::SetCursorPos(20, 400) | Out-Null
Start-Sleep -Milliseconds 1600
bun scripts/cdp-eval.ts 9223 'JSON.stringify(window.__dz)'
