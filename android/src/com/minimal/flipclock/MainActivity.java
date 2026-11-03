package com.minimal.flipclock;

import android.app.Activity;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private WebView web;
    private boolean fullscreen = false;
    private ToneGenerator tone;
    private AppUpdater updater;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        updater = new AppUpdater(this);
        getWindow().setStatusBarColor(Color.rgb(12,13,15));
        getWindow().setNavigationBarColor(Color.rgb(12,13,15));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(12,13,15));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
        });
        web.addJavascriptInterface(new Device(), "AndroidClock");
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
        web.postDelayed(() -> { if (!isDestroyed() && updater.autoEnabled()) updater.check(true); }, 3000);
    }

    private void applyFullscreen() {
        getWindow().getDecorView().setSystemUiVisibility(fullscreen ?
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE :
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    public final class Device {
        @JavascriptInterface public String appInfo() {
            return "{\"version\":\"" + updater.versionName() + "\",\"automatic\":" + updater.autoEnabled() + "}";
        }
        @JavascriptInterface public void checkUpdates() { runOnUiThread(() -> updater.check(false)); }
        @JavascriptInterface public void autoUpdates(boolean enabled) { updater.setAutoEnabled(enabled); }

        @JavascriptInterface public void keepAwake(boolean enabled) {
            runOnUiThread(() -> {
                if (enabled) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
        @JavascriptInterface public void toggleFullscreen() {
            runOnUiThread(() -> {
                fullscreen = !fullscreen;
                applyFullscreen();
                web.evaluateJavascript("document.body.classList.toggle('immersed', " + fullscreen + ")", null);
            });
        }
        @JavascriptInterface public void finished(boolean sound, boolean vibration) {
            runOnUiThread(() -> {
                if (sound) {
                    if (tone != null) tone.release();
                    tone = new ToneGenerator(AudioManager.STREAM_ALARM, 75);
                    tone.startTone(ToneGenerator.TONE_PROP_ACK, 600);
                }
                if (vibration) {
                    Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                    if (vibrator != null && vibrator.hasVibrator())
                        vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,200,100,200}, -1));
                }
            });
        }
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) applyFullscreen();
    }
    @Override protected void onResume() {
        super.onResume();
        if (updater != null) updater.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("if(typeof render==='function')render()", null);
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("document.querySelectorAll('dialog[open]').forEach(d=>d.close())", null);
        if (fullscreen) { fullscreen = false; applyFullscreen(); }
        else moveTaskToBack(true);
    }
    @Override protected void onDestroy() {
        if (tone != null) tone.release();
        if (updater != null) updater.destroy();
        web.removeJavascriptInterface("AndroidClock");
        web.destroy();
        super.onDestroy();
    }
}
