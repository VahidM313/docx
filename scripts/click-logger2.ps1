$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI2 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public class W8 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI2[] inputs, int size);
}
'@
function Click($x, $y) {
  [W8]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 700
  $down = New-Object MI2; $down.dwFlags = 2
  $up = New-Object MI2; $up.dwFlags = 4
  [W8]::SendInput(1, @($down), 28) | Out-Null; Start-Sleep -Milliseconds 140
  [W8]::SendInput(1, @($up), 28) | Out-Null
  Start-Sleep -Milliseconds 700
}
bun scripts/cdp-eval.ts 9223 --file _logger.js

# click rail Home icon (currently in the Tailwind doc): should navigate home
Click 37 45
bun scripts/cdp-eval.ts 9223 'JSON.stringify(window.__c)'

# click hub Tailwind card Open again for comparison (content button)
Click 242 455
bun scripts/cdp-eval.ts 9223 'JSON.stringify(window.__c)'
