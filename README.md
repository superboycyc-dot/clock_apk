# 翻页时钟

适用于 Android 8.0 及以上的极简翻页时钟。黑白界面，蓝、黄、橙色用于状态提示，支持横竖屏。

[下载最新 APK](https://github.com/superboycyc-dot/clock_apk/releases/latest)

- 当前时间：翻页显示，可选秒数、日期和 12 小时制。
- 专注模式：分钟滚轮，15 / 30 / 45 / 60 分钟预设，保留最近一次自定义时长。
- 普通启动：轻点屏幕暂停或继续；暂停时底部显示结束按钮。
- 超级启动：轻点屏幕切换倒计时与正计时，走神时间会累加到剩余时长。
- 超级模式外圈：从 12 点方向开始，蓝色逆时针倒计时、黄色顺时针正计时；正计时超过初始时长后橙红闪烁。
- 支持 +5 / +10 分钟、翻页 / 数字切换、常亮和全屏。

## 安装及更新

下载 APK，用 Type-C 数据线复制到手机，再在手机文件管理器中点击安装。新版使用相同签名，可直接覆盖安装。

应用启动时自动检查本仓库的 GitHub Releases。设置中可关闭自动检查，也可以手动「检查更新」。发现新版后，选择下载；下载完成会校验 SHA-256、应用包名、递增版本号和安装签名，再交给安卓系统确认安装。首次更新需要允许本应用安装软件。应用不会静默安装，也不需要 GitHub 账号或访问令牌。

当前本地安装文件：`dist/FlipClock-1.2.0.apk`。本次新增超级模式和更新功能。

时钟和计时功能可离线使用。网络权限仅用于访问 GitHub 更新；不上传计时记录或设置。首次没有发布新版、断网或无法访问 GitHub 时，计时仍正常，手动检查会提示失败。

## 本地构建

需要 JDK、Python 3，以及 Android SDK Platform 35 和 Build Tools 35.0.0。可通过官方 Android SDK 管理器安装：

```sh
sdkmanager 'platforms;android-35' 'build-tools;35.0.0'
export ANDROID_SDK_ROOT=/path/to/android-sdk
sh ./build_apk.sh
```

原开发电脑也支持项目内 `.tools/` 的编译工具。构建脚本自动读取清单中的版本，输出签名 APK、`update.json` 和 `SHA256SUMS.txt`。

签名密钥和密码位于本机 `.signing/`，均被 Git 忽略。发布更新必须保留同一密钥。新电脑没有原密钥时生成的新签名不能覆盖原版。

## 发布更新

1. 增加 `android/AndroidManifest.xml` 的 `versionCode` 和 `versionName`，更新 `RELEASE_NOTES.md`。
2. 使用原签名密钥构建 APK。
3. 把源代码提交到本仓库。在 GitHub 创建对应版本的 Release，同时上传构建所得 APK、`update.json`、`SHA256SUMS.txt`，设为 Latest。
4. 已安装应用下次检查时即可发现更新。

如已安装并登录 GitHub CLI，可运行 `sh scripts/publish_release.sh` 完成构建和 Release 发布。不要将 `.signing/`、`.tools/`、下载缓存或任何访问令牌上传到仓库。

## 验证

```sh
node tests/timer.test.cjs
mkdir -p .build/policy-tests
javac -d .build/policy-tests android/src/com/minimal/flipclock/UpdateConfig.java android/src/com/minimal/flipclock/UpdatePolicy.java tests/UpdatePolicyTest.java
java -ea -cp .build/policy-tests com.minimal.flipclock.UpdatePolicyTest
python3 tests/release.test.py
```

APK 经过 Java / DEX 编译、v2/v3 签名验证、ZIP 对齐和资源完整性检查。当前电脑未安装安卓模拟器，未完成手机端下载、权限授权及安装流程的真机验证。

后台倒计时按真实截止时间校准，超级正计时也会按实际经过时间恢复。当前没有后台闹钟服务，应用被系统冻结或关闭时，结束提醒可能延迟至重新打开应用。

网页预览：`python3 -m http.server 8765 --bind 127.0.0.1 --directory web`。
