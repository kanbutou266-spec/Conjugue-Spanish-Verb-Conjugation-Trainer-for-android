#!/usr/bin/env bash
# 西语动词变位练习器 · RN 真机联调一键准备
#
# 换手机 / 每次重新插线后跑一次：
#     bash scripts/dev-connect.sh
#
# 做四件事（幂等，重复跑没副作用）：
#   1. 确认 adb 认到了一台已授权的设备
#   2. adb reverse tcp:8081 tcp:8081   ← 让手机经 USB 访问电脑的 Metro（每台手机都要单独做）
#   3. App 没装就装上现成的 universalAPK（省掉 26 分钟的 Gradle 构建）
#   4. 启动 App
#
# 需要 Metro 在另一个终端跑着：cd /d/dev/es-conjugator-rn && npx expo start

set -uo pipefail

ADB="${ADB:-D:/dev/android-sdk/platform-tools/adb.exe}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.esconj.trainer"

# Git Bash 会把 /sdcard 之类当本地路径转换，adb 的参数必须关掉这个行为
export MSYS_NO_PATHCONV=1

c_red()  { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
c_dim()  { printf '\033[2m%s\033[0m\n' "$*"; }

if [ ! -x "$ADB" ] && ! command -v "$ADB" >/dev/null 2>&1; then
  c_red "找不到 adb：$ADB"
  echo "  改一下环境变量再跑：ADB=/你的/adb bash scripts/dev-connect.sh"
  exit 1
fi

echo "== 1/4 检查设备 =="
# 只看 status 是 device 的行（unauthorized / offline 都不算就绪）
DEVS="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}')"
COUNT="$(printf '%s\n' "$DEVS" | grep -c . || true)"

if [ "$COUNT" -eq 0 ]; then
  c_red "adb 没认出任何已授权的设备。"
  echo
  c_dim "$("$ADB" devices | sed 's/^/  /')"
  echo
  c_ylw "排查顺序（按命中概率排）："
  cat <<'EOF'
  1) 换回「上一台手机用过的那个 USB 口」——本机自身跑在虚拟机里，
     USB 直通是按物理端口配的，换口可能宿主机没透传进来 → Windows 一个设备都看不到。
  2) 换一根确定能传数据的线（很多随机附带的线只能充电）。看手机有没有充电提示，
     连充电提示都没有 = 线或口的问题，跟调试开关无关。
  3) 直插机箱，别走扩展坞 / USB Hub / 前置面板。
  4) 手机端（小米 / 红米）：
     · 设置 → 我的设备 → 全部参数与信息 → 连点「MIUI 版本 / HyperOS 版本」7 次 → 输锁屏密码
     · 设置 → 更多设置 → 开发者选项 → 打开「USB 调试」
     · 下拉通知栏 →「正在通过 USB 充电」→ 改成「传输文件(MTP)」
     · 这时手机弹出「允许 USB 调试吗？」→ 勾「一律允许」→ 允许
  5) 上面都对还是不行 → 拔掉重插，或换个 USB 口再来一遍。
  6) 兜底方案：无线调试（Android 11+，彻底不用 USB）：
     adb pair <手机IP>:<配对端口> <配对码>     # 开发者选项 → 无线调试 → 使用配对码配对设备
     adb connect <手机IP>:<调试端口>
EOF
  echo
  c_dim "就绪后会显示：$ADB devices  →  xxxxxxxx  device"
  exit 1
fi

if [ "$COUNT" -gt 1 ]; then
  c_ylw "认到多台设备，用第一台：$(echo "$DEVS" | head -1)"
  c_dim "（想指定就用 adb -s <序列号> ...）"
fi
DEV="$(echo "$DEVS" | head -1)"
c_grn "设备已就绪：$DEV"

echo
echo "== 2/4 端口反向代理（手机 → 电脑的 Metro）=="
if "$ADB" -s "$DEV" reverse tcp:8081 tcp:8081; then
  c_grn "8081 已反向映射（手机访问 localhost:8081 = 访问电脑的 Metro）"
else
  c_red "reverse 失败 —— 手机若走无线调试可跳过这步，改用电脑局域网 IP 连 Metro"
fi

echo
echo "== 3/4 检查 App 是否已安装 =="
if "$ADB" -s "$DEV" shell pm list packages 2>/dev/null | grep -q "$PKG"; then
  c_grn "$PKG 已安装，跳过"
else
  c_ylw "$PKG 未安装 → 装现成的 universal APK（含 arm64-v8a/armeabi-v7a/x86/x86_64）"
  if [ ! -f "$APK" ]; then
    c_red "APK 不存在：$APK"
    echo "  需要重新构建：cd $ROOT && npx expo run:android（约 26 分钟）"
    exit 1
  fi
  c_dim "  文件：$APK  （$(du -h "$APK" | cut -f1)）"
  if ! "$ADB" -s "$DEV" install -r "$APK"; then
    c_red "安装失败。若是 INSTALL_FAILED_UPDATE_INCOMPATIBLE，先卸载："
    echo "  $ADB -s $DEV uninstall $PKG"
    exit 1
  fi
  c_grn "安装完成"
fi

echo
echo "== 4/4 启动 App =="
"$ADB" -s "$DEV" shell am force-stop "$PKG"
"$ADB" -s "$DEV" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
c_grn "已拉起 $PKG"

echo
c_dim "──────────────────────────────────────────────"
c_ylw "别忘了 Metro 得在另一个终端跑着，否则手机上会白屏："
echo "  cd $ROOT && npx expo start"
c_dim "改完 RN 代码别信热更新，走：停 Metro → npx expo start --clear → 重跑本脚本"
c_dim "──────────────────────────────────────────────"
