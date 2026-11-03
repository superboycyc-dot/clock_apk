package com.minimal.flipclock;

public final class UpdatePolicyTest {
    public static void main(String[] args) {
        assert UpdatePolicy.trustedAsset("https://github.com/superboycyc-dot/clock_apk/releases/download/v1.2.0/update.json");
        assert UpdatePolicy.trustedTransport("https://release-assets.githubusercontent.com/github-production-release-asset/123");
        assert UpdatePolicy.trustedTransport("https://api.github.com/repos/superboycyc-dot/clock_apk/releases/latest");
        for(String url:new String[]{"http://github.com/superboycyc-dot/clock_apk/releases/download/v1/a.apk", "https://github.com.evil.test/a", "https://github.com@evil.test/a", "https://github.com:8443/a", "file:///tmp/app.apk", "https://evil.test/a"}) assert !UpdatePolicy.trustedTransport(url):url;
        for(String url:new String[]{"https://github.com/other/clock_apk/releases/download/v1/a.apk", "https://github.com/superboycyc-dot/clock_apk-evil/releases/download/v1/a.apk", "https://github.com/superboycyc-dot/clock_apk/releases/download/../bad", "https://api.github.com/repos/superboycyc-dot/clock_apk/releases/latest"}) assert !UpdatePolicy.trustedAsset(url):url;
        assert UpdatePolicy.validApkName("FlipClock-1.2.0.apk");
        assert !UpdatePolicy.validApkName("../FlipClock-1.2.0.apk");
        assert !UpdatePolicy.validApkName("FlipClock-1.2.0.apk.exe");
        assert UpdatePolicy.validDigest("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
        assert !UpdatePolicy.validDigest("abcdef");
        System.out.println("Update policy passed: HTTPS, repository, redirect hosts, APK names and SHA-256.");
    }
}
