$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI3 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class W9 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI3[] inputs, int size);
}
'@
function Click($x, $y, $tag) {
  [W9]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 700
  $down = New-Object MI3; $down.dwFlags = 2
  $up = New-Object MI3; $up.dwFlags = 4
  [W9]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 150
  [W9]::SendInput(1, @($up), 28) | Out-Null
  Start-Sleep -Milliseconds 900
  Write-Host "clicked: $tag"
  bun scripts/cdp-hover.ts 9223 9999,9999 150 "_t$tag.png" | Out-Null
}
# we are in the Tailwind doc; try rail Home 3 times with a state screenshot after each
Click 37 45 "1"
Click 37 45 "2"
Click 37 45 "3"
