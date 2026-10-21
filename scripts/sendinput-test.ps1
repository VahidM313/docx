$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public struct PT2 { public int X; public int Y; }
public class W4 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out PT2 p);
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public MOUSEINPUT mi; }
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
}'
function Go($x, $y, $ms = 800) { [W4]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds $ms
  $p = New-Object PT2; [W4]::GetCursorPos([ref]$p) | Out-Null
  Write-Host "cursor now: $($p.X),$($p.Y)" }
function ClickSi($x, $y) {
  Go $x $y
  $down = New-Object W4+INPUT; $down.type = 0; $down.mi.dwFlags = 2
  $up = New-Object W4+INPUT; $up.type = 0; $up.mi.dwFlags = 4
  $batch = @($down, $up)
  $r = [W4]::SendInput(2, $batch, [System.Runtime.InteropServices.Marshal]::SizeOf([type][W4+INPUT]))
  Write-Host "SendInput sent: $r"
  Start-Sleep -Milliseconds 700
}
bun scripts/cdp-eval.ts 9223 "window.__c=[];document.addEventListener('pointerdown',e=>(window.__c=window.__c||[]).push('PD|'+e.clientX+','+e.clientY),true);document.addEventListener('click',e=>(window.__c=window.__c||[]).push('CL|'+(e.target.textContent||'').slice(0,20)+'|'+e.clientX+','+e.clientY),true);'logger on'"
ClickSi 242 455
bun scripts/cdp-eval.ts 9223 "JSON.stringify(window.__c)"
