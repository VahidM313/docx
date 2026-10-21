$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI4 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class WA {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI4[] inputs, int size);
}
'@
function Click($x, $y, $tag) {
  [WA]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 700
  $down = New-Object MI4; $down.dwFlags = 2
  $up = New-Object MI4; $up.dwFlags = 4
  [WA]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
  [WA]::SendInput(1, @($up), 28) | Out-Null
  Start-Sleep -Milliseconds 900
  bun scripts/cdp-hover.ts 9223 9999,9999 150 "_k$tag.png" | Out-Null
  Write-Host "clicked $tag"
}
bun scripts/cdp-eval.ts 9223 --file _home-click.js
bun scripts/cdp-eval.ts 9223 "document.title"
# 1: real click rail BOOKMARK icon while on hub
Click 37 122 "1book"
# 2: real click hub card Open button
Click 242 455 "2open"
