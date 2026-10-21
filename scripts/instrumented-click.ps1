$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI8 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class WG {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI8[] inputs, int size);
}
'@
function Dz($tag) { $r = bun scripts/cdp-eval.ts 9223 "JSON.stringify({dz: window.__dz, c: window.__c, d: document.querySelectorAll('[role=dialog]').length})" | Out-String; Write-Host "$tag -> $r" }
bun scripts/cdp-eval.ts 9223 --file _logger.js | Out-Null
[WG]::SetCursorPos(20, 400) | Out-Null
Start-Sleep -Milliseconds 350
Dz "strip-hover"
[WG]::SetCursorPos(80, 98) | Out-Null
Start-Sleep -Milliseconds 350
Dz "in-panel"
$down = New-Object MI8; $down.dwFlags = 2
$up = New-Object MI8; $up.dwFlags = 4
[WG]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
[WG]::SendInput(1, @($up), 28) | Out-Null
Start-Sleep -Milliseconds 700
Dz "after-click"
