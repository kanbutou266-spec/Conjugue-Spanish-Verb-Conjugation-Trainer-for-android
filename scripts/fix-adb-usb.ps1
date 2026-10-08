# fix-adb-usb.ps1 - Fix "phone connected but adb cannot see it" (Windows USB side)
#
# Root cause (diagnosed 2026-10-03):
#   Windows 11 ships C:\Windows\INF\winusb.inf with a built-in Android ADB section:
#       [ADB.HW.AddReg]
#       HKR,,DeviceInterfaceGUIDs,0x10000,"{F72FE0D4-CBCB-407D-8814-9ED673D0DD6B}"
#   That GUID is only written when a device matches the [ADB] section.
#   Huawei phones list "USB\MS_COMP_WINUSB" FIRST among their compatible IDs,
#   so Windows picks the generic [WINUSB] section instead -> GUID never written
#   -> adb.exe (which only looks for that one GUID) sees nothing.
#
# What this script does:
#   1. writes that GUID into the device's "Device Parameters" registry key
#   2. restarts the device node so winusb.sys re-registers the interface
#   3. verifies with "adb devices"
#
# Usage (MUST run as Administrator):
#   double-click fix-adb-usb.cmd
#   or from an elevated terminal:
#     powershell -ExecutionPolicy Bypass -File "%TEMP%\fix-adb-usb.ps1"
#
# Revert:
#   Remove-ItemProperty -Path <key> -Name DeviceInterfaceGUIDs,DeviceInterfaceGUID

$ErrorActionPreference = 'Continue'
$ADB      = 'D:\dev\android-sdk\platform-tools\adb.exe'
$GUID_ADB = '{F72FE0D4-CBCB-407D-8814-9ED673D0DD6B}'
$LOG      = "$env:TEMP\fix-adb-usb.log"

try { Start-Transcript -Path $LOG -Force | Out-Null } catch {}

function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }

function Write-AdbGuid($k, $g) {
  New-ItemProperty -Path $k -Name 'DeviceInterfaceGUIDs' -PropertyType MultiString `
      -Value $g -Force -ErrorAction Stop | Out-Null
  New-ItemProperty -Path $k -Name 'DeviceInterfaceGUID' -PropertyType String `
      -Value $g -Force -ErrorAction Stop | Out-Null
}

trap { Say ("[x] unexpected error: " + $_.Exception.Message) 'Red' }

# ---- 0. require admin ------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Say "[x] Administrator rights required. Re-run from an elevated terminal." 'Red'
  exit 1
}
Say "[1/5] admin OK"

# ---- 1. locate the phone ADB interface -------------------------------------
$devs = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
        Where-Object { $_.InstanceId -like 'USB\VID_12D1&PID_107E&MI_02*' }
if (-not $devs) {
  Say "[x] ADB interface not found (USB\VID_12D1&PID_107E&MI_02). Is the phone plugged in?" 'Red'
  Say "    current VID_12D1 devices:" 'DarkGray'
  Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.InstanceId -like '*VID_12D1*' } |
    ForEach-Object { Say ("      " + $_.Status + "  " + $_.InstanceId) 'DarkGray' }
  exit 1
}
$inst = $devs[0].InstanceId
Say "[2/5] target: $inst  (status $($devs[0].Status))"

$key = "HKLM:\SYSTEM\CurrentControlSet\Enum\$inst\Device Parameters"

# ---- 2. write the ADB interface GUID ---------------------------------------
try {
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  Write-AdbGuid $key $GUID_ADB
  Say "[3/5] DeviceInterfaceGUIDs written = $GUID_ADB"
} catch {
  Say "[!] direct write failed: $($_.Exception.Message)" 'Yellow'
  Say "    taking ownership of the key and retrying..." 'Yellow'
  $regPath = "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Enum\$inst\Device Parameters"
  & takeown.exe /f $regPath /a | Out-Null
  & icacls.exe $regPath /grant "*S-1-5-32-544:(F)" | Out-Null
  try {
    Write-AdbGuid $key $GUID_ADB
    Say "[3/5] written after taking ownership"
  } catch {
    Say "[x] still cannot write: $($_.Exception.Message)" 'Red'
    exit 1
  }
}

# ---- 3. restart the device node so winusb re-registers the interface -------
Say "[4/5] restarting device node..."
$restarted = $false
& pnputil.exe /restart-device "$inst" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  $restarted = $true
  Say "      restarted via pnputil /restart-device" 'DarkGray'
}
if (-not $restarted) {
  Say "      pnputil failed, falling back to disable/enable..." 'DarkGray'
  Disable-PnpDevice -InstanceId $inst -Confirm:$false -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Enable-PnpDevice  -InstanceId $inst -Confirm:$false -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 5

# ---- 4. verify -------------------------------------------------------------
Say "[5/5] checking adb..."
$list = @()
for ($i = 1; $i -le 4; $i++) {
  & $ADB kill-server | Out-Null
  Start-Sleep -Seconds 1
  $list = & $ADB devices -l
  Say ("      try$i : " + (($list | Where-Object { $_ -match '\S' }) -join ' / ')) 'DarkGray'
  if (($list | Where-Object { $_ -match '^(?!List of devices)\S+\s+(device|unauthorized)' })) { break }
  Start-Sleep -Seconds 3
}

$joined = ($list -join "`n")
if ($joined -match '(?m)^\S+\s+device\b') {
  Say ""
  Say "[OK] SUCCESS - adb can see the phone." 'Green'
} elseif ($joined -match '(?m)^\S+\s+unauthorized\b') {
  Say ""
  Say "[OK] adb sees the phone but it is UNAUTHORIZED." 'Green'
  Say "     Tap 'Allow' / 'Always allow' on the phone screen." 'Green'
} else {
  Say ""
  Say "[!] still not detected." 'Yellow'
  Say "    Unplug and replug the USB cable, then run this script again." 'Yellow'
}

Say ""
Say "Full log: $LOG" 'DarkGray'
Say "(this window closes in 15s)" 'DarkGray'
try { Stop-Transcript | Out-Null } catch {}
Start-Sleep -Seconds 15
