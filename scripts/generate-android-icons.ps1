Add-Type -AssemblyName System.Drawing

$srcIconPath = "d:\Dev\docx\docs-desktop\src-tauri\icons\icon.png"
if (-not (Test-Path $srcIconPath)) {
    Write-Error "Source icon not found at $srcIconPath"
    exit 1
}

$srcBmp = [System.Drawing.Bitmap]::new($srcIconPath)
$resDir = "d:\Dev\docx\docs-desktop\src-tauri\gen\android\app\src\main\res"

function Save-PaddedIcon([System.Drawing.Bitmap]$source, [int]$totalSize, [double]$innerRatio, [string]$outPath, [bool]$darkBackground = $false) {
    $bmp = [System.Drawing.Bitmap]::new($totalSize, $totalSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($darkBackground) {
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 9, 9, 11))
        $g.FillRectangle($brush, 0, 0, $totalSize, $totalSize)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $innerSize = [int][Math]::Round($totalSize * $innerRatio)
    $offset = [int][Math]::Round(($totalSize - $innerSize) / 2.0)
    $dstRect = [System.Drawing.Rectangle]::new($offset, $offset, $innerSize, $innerSize)
    $srcRect = [System.Drawing.Rectangle]::new(0, 0, $source.Width, $source.Height)

    $g.DrawImage($source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    $parent = Split-Path $outPath -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $outPath (${totalSize}x${totalSize})"
}

# 1. Standard Legacy App Icons (ic_launcher.png & ic_launcher_round.png) with dark background
$densities = @{
    "mipmap-mdpi"    = @{ icon = 48;  fg = 108 }
    "mipmap-hdpi"    = @{ icon = 72;  fg = 162 }
    "mipmap-xhdpi"   = @{ icon = 96;  fg = 216 }
    "mipmap-xxhdpi"  = @{ icon = 144; fg = 324 }
    "mipmap-xxxhdpi" = @{ icon = 192; fg = 432 }
}

foreach ($density in $densities.Keys) {
    $sizes = $densities[$density]
    $dir = Join-Path $resDir $density

    # Standard app icon with dark #09090b background
    $iconPath = Join-Path $dir "ic_launcher.png"
    Save-PaddedIcon $srcBmp $sizes.icon 0.82 $iconPath $true

    # Round app icon with dark #09090b background
    $roundPath = Join-Path $dir "ic_launcher_round.png"
    Save-PaddedIcon $srcBmp $sizes.icon 0.82 $roundPath $true

    # Adaptive icon foreground (transparent, 66% safe zone centered in 108dp)
    $fgPath = Join-Path $dir "ic_launcher_foreground.png"
    Save-PaddedIcon $srcBmp $sizes.fg 0.64 $fgPath $false
}

$srcBmp.Dispose()
Write-Output "All Android icons updated successfully from Docx icon.png!"
