$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MIA { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class WI {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MIA[] inputs, int size);
}
'@
[WI]::SetCursorPos(242, 455) | Out-Null
Start-Sleep -Milliseconds 500
for ($i = 1; $i -le 3; $i++) {
  $down = New-Object MIA; $down.dwFlags = 2
  $up = New-Object MIA; $up.dwFlags = 4
  [WI]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
  [WI]::SendInput(1, @($up), 28) | Out-Null
  Start-Sleep -Milliseconds 1000
  bun scripts/cdp-hover.ts 9223 9999,9999 150 "_q$i.png" | Out-Null
  Write-Host "click $i done"
}
bun scripts/cdp-eval.ts 9223 "document.title + ' | iframes=' + document.querySelectorAll('iframe').length"
