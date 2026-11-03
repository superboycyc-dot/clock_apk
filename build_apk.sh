#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/35.0.0"
    ANDROID_JAR="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
else
    BUILD_TOOLS="$PWD/.tools/build-tools/android-15"
    ANDROID_JAR="$PWD/.tools/platform/android-35/android.jar"
fi
APP_VERSION=$(python3 -c 'import xml.etree.ElementTree as E; print(E.parse("android/AndroidManifest.xml").getroot().get("{http://schemas.android.com/apk/res/android}versionName"))')
APK="dist/FlipClock-$APP_VERSION.apk"
mkdir -p .build/classes .build/dex .signing dist
"$BUILD_TOOLS/aapt2" compile --dir android/res -o .build/resources.zip
"$BUILD_TOOLS/aapt2" link -o .build/unsigned.apk -I "$ANDROID_JAR" --manifest android/AndroidManifest.xml -A web .build/resources.zip
javac -source 8 -target 8 -classpath "$ANDROID_JAR" -d .build/classes android/src/com/minimal/flipclock/*.java
jar cf .build/classes.jar -C .build/classes .
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output .build/dex .build/classes.jar
(cd .build/dex && zip -q ../unsigned.apk classes.dex)
"$BUILD_TOOLS/zipalign" -f -p 4 .build/unsigned.apk .build/aligned.apk
if [ ! -f .signing/release.p12 ]; then
    python3 -c 'import secrets,pathlib; pathlib.Path(".signing/password").write_text(secrets.token_urlsafe(32))'
    chmod 600 .signing/password
    keytool -genkeypair -keystore .signing/release.p12 -storepass:file .signing/password -alias flipclock -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Flip Clock" -storetype PKCS12
    chmod 600 .signing/release.p12
fi
"$BUILD_TOOLS/apksigner" sign --ks .signing/release.p12 --ks-pass file:.signing/password --ks-key-alias flipclock --out "$APK" .build/aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose "$APK"
"$BUILD_TOOLS/zipalign" -c 4 "$APK"
python3 scripts/release_metadata.py
