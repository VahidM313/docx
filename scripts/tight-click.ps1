$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI7 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class WF {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI7[] inputs, int size);
}
'@
function Dz($tag) { $r = bun scripts/cdp-eval.ts 9223 "JSON.stringify(window.__dz||{})" | Out-String; Write-Host "$tag -> $r" }
[WF]::SetCursorPos(80, 98) | Out-Null
Start-Sleep -Milliseconds 400
Dz "after-move"
$down = New-Object MI7; $down.dwFlags = 2
$up = New-Object MI7; $up.dwFlags = 4
[WF]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
[WF]::SendInput(1, @($up), 28) | Out-Null
Start-Sleep -Milliseconds 700
Dz "after-click"
bun scripts/cdp-eval.ts 9223 "document.querySelectorAll('[role=dialog]').length"
