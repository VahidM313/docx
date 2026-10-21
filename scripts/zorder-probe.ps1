Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public struct RC3 { public int L; public int T; public int R; public int B; }
public class WZ {
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC3 r);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
}
'@
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public struct PT4 { public int X; public int Y; }
public class WY {
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(PT4 p);
}
'@
$pt = New-Object PT4; $pt.X = 302; $pt.Y = 567
$app = [WY]::WindowFromPoint($pt)
Write-Host "app hwnd at point: $app"
$cur = [WZ]::GetWindow($app, 3)  # GW_HWNDPREV
Write-Host "first above: $cur"
# walk the Z chain from the app window UP (GW_HWNDPREV = window ABOVE it)
$cur = [WZ]::GetWindow($app, 3)  # GW_HWNDPREV
$i = 0
while ($cur -ne [IntPtr]::Zero -and $i -lt 25) {
  $cn = New-Object System.Text.StringBuilder 128
  [WZ]::GetClassName($cur, $cn, 128) | Out-Null
  $tt = New-Object System.Text.StringBuilder 128
  [WZ]::GetWindowText($cur, $tt, 128) | Out-Null
  $r = New-Object RC3
  [WZ]::GetWindowRect($cur, [ref]$r) | Out-Null
  $pid2 = 0; [WZ]::GetWindowThreadProcessId($cur, [ref]$pid2) | Out-Null
  $proc = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName
  $style = [WZ]::GetWindowLong($cur, -16); $ex = [WZ]::GetWindowLong($cur, -20)
  $covers = ($r.L -le 302 -and $r.R -ge 302 -and $r.T -le 567 -and $r.B -ge 567)
  $vis = [WZ]::IsWindowVisible($cur)
  "ABOVE[$i] final=$($cn) '$($tt)' proc=$proc rect=($($r.L),$($r.T))-($($r.R),$($r.B)) covers=$covers vis=$vis style=0x$($style.ToString('X')) ex=0x$($ex.ToString('X'))"
  $cur = [WZ]::GetWindow($cur, 3)
  $i++
}
