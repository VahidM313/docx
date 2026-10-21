$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; public struct MI9 { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
public struct PT3 { public int X; public int Y; }
public class WH {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, MI9[] inputs, int size);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(PT3 p);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, UIntPtr w, IntPtr l);
}
'@
# A) injection-level check: hold left down and read async key state
[WH]::SetCursorPos(242, 455) | Out-Null
$down = New-Object MI9; $down.dwFlags = 2
$up = New-Object MI9; $up.dwFlags = 4
[WH]::SendInput(1, @($down), 28) | Out-Null
Start-Sleep -Milliseconds 250
$ks = [WH]::GetAsyncKeyState(1)
[WH]::SendInput(1, @($up), 28) | Out-Null
Write-Host "GetAsyncKeyState(LBUTTON) during injected press: 0x$($ks.ToString('X'))"

# B) PostMessage click to the RenderWidgetHost hwnd under the point
Start-Sleep -Milliseconds 500
$pt = New-Object PT3; $pt.X = 302; $pt.Y = 567
$h = [WH]::WindowFromPoint($pt)
$cn = New-Object System.Text.StringBuilder 128
[WH]::GetClassName($h, $cn, 128) | Out-Null
Write-Host "target hwnd: $h class='$($cn)'"
$lparam = [IntPtr](302 -bor (567 -shl 16))
$wDown = [UIntPtr][UInt64]1
[WH]::PostMessage($h, 0x0201, $wDown, $lparam) | Out-Null   # WM_LBUTTONDOWN
Start-Sleep -Milliseconds 120
[WH]::PostMessage($h, 0x0202, [UIntPtr][UInt64]0, $lparam) | Out-Null   # WM_LBUTTONUP
Start-Sleep -Milliseconds 1200
bun scripts/cdp-eval.ts 9223 "document.title + ' | iframes=' + document.querySelectorAll('iframe').length"
