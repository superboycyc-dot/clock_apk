package com.minimal.flipclock;

import java.net.URI;

final class UpdatePolicy {
    static final long MAX_APK_BYTES = 100L * 1024 * 1024;
    static boolean trustedTransport(String value) {
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && ("github.com".equals(host) || "api.github.com".equals(host)
                || "release-assets.githubusercontent.com".equals(host)
                || "objects.githubusercontent.com".equals(host));
        } catch (Exception e) { return false; }
    }
    static boolean trustedAsset(String value) {
        try {
            URI uri = new URI(value);
            return trustedTransport(value) && "github.com".equals(uri.getHost())
                && uri.getPath().startsWith("/" + UpdateConfig.REPOSITORY + "/releases/download/")
                && !uri.getPath().contains("/../");
        } catch (Exception e) { return false; }
    }
    static boolean validDigest(String value) { return value != null && value.matches("[a-fA-F0-9]{64}"); }
    static boolean validApkName(String value) { return value != null && value.matches("FlipClock-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk"); }
    private UpdatePolicy() {}
}
