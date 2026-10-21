Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public struct RC { public int L; public int T; public int R; public int B; }
public class W5 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string n);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(PTP p);
  [StructLayout(LayoutKind.Sequential)] public struct PTP { public int X; public int Y; }
}
'@
$pt = New-Object W5+PTP; $pt.X = 302; $pt.Y = 568
$main0 = [W5]::WindowFromPoint($pt)
$main = $main0
"hit hwnd: $main0"
$cb = [W5+EnumProc] { param($h, $l)
  $cn = New-Object System.Text.StringBuilder 128
  [W5]::GetClassName($h, $cn, 128) | Out-Null
  $r = New-Object RC
  [W5]::GetWindowRect($h, [ref]$r) | Out-Null
  "  child $($h) class='$($cn)' rect=($($r.L),$($r.T))-($($r.R),$($r.B))"
  return $true
}
[W5]::EnumChildWindows($main, $cb, [IntPtr]::Zero) | Out-Null
# what HWND is exactly under the click point?
$pt = New-Object W5+PTP; $pt.X = 302; $pt.Y = 568
$hw = [W5]::WindowFromPoint($pt)
"WindowFromPoint(302,568) hwnd: $hw"
# find Docx webview processes
Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Id, MainWindowTitle | Format-Table -AutoSize | Out-String
