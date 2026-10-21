$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI6 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class WE {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI6[] inputs, int size);
}
'@
# close the drawer that just opened (cursor stays at 20,400 = sidebar band kept open)
bun scripts/cdp-eval.ts 9223 "for (let i=0;i<3;i++) document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));'sent'"
Start-Sleep -Milliseconds 600
# overlay should still be open (cursor cx=20): real-click the Bookmarks row css (80,98)
[WE]::SetCursorPos(80, 98) | Out-Null; Start-Sleep -Milliseconds 900
$down = New-Object MI6; $down.dwFlags = 2
$up = New-Object MI6; $up.dwFlags = 4
[WE]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
[WE]::SendInput(1, @($up), 28) | Out-Null
Start-Sleep -Milliseconds 900
bun scripts/cdp-eval.ts 9223 "document.querySelectorAll('[role=dialog]').length"
bun scripts/cdp-hover.ts 9223 9999,9999 200 _real-bookmark.png
