# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and change the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html
#
# ---------------------------------------------------------------------------
# 本文件只在 android.enableMinifyInReleaseBuilds=true 时生效（见 gradle.properties）。
# 大部分规则其实由依赖的 AAR 自带（react-android、expo-modules-core、
# react-native-screens 等都有 consumer rules），这里只补「靠反射注册、
# AAR 没覆盖到」的部分。
#
# 排查方法：R8 之后若出现 NoClassDefFoundError / ClassNotFoundException /
# 原生模块方法找不到，看 logcat 里被裁掉的类名，按下面格式补 keep 规则。
# ---------------------------------------------------------------------------

# react-native-reanimated（含 Reanimated 4 的 worklets —— 两者都靠
# TurboModule/反射注册，名字被混淆会导致「原生模块找不到」）
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# 通过 @ReactModule 注解注册的原生模块（注解里的名字即 JS 侧的模块名，不能改）
-keep @com.facebook.react.module.annotations.ReactModule class * { *; }
-keep class * implements com.facebook.react.bridge.NativeModule { *; }

# RN 自带的 @DoNotStrip 标记（被 JNI 直接调用的成员）
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keep @com.facebook.common.internal.DoNotStrip class * { *; }
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers class * { @com.facebook.common.internal.DoNotStrip *; }

# Add any project specific keep options here:
