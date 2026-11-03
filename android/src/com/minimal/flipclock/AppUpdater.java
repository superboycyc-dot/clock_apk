package com.minimal.flipclock;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

final class AppUpdater {
    private final Activity activity;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean();
    private boolean waitingForPermission;
    private long pendingVersion;
    private String pendingSha;
    private String offeredTag="";
    AppUpdater(Activity activity) { this.activity=activity; }
    private void ui(Runnable action) {
        activity.runOnUiThread(()->{if(!activity.isFinishing()&&!activity.isDestroyed()) action.run();});
    }
    private void message(String text) { ui(()->Toast.makeText(activity,text,Toast.LENGTH_LONG).show()); }
    private long version(PackageInfo p) { return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode; }
    private int signatureFlags() { return Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES; }
    String versionName() {
        try { return activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionName; }
        catch(Exception e) { return ""; }
    }
    boolean autoEnabled() { return activity.getSharedPreferences("updates",0).getBoolean("automatic",true); }
    void setAutoEnabled(boolean enabled) { activity.getSharedPreferences("updates",0).edit().putBoolean("automatic",enabled).apply(); }
    void check(boolean silent) {
        if(!busy.compareAndSet(false,true)) { if(!silent)message("正在检查或下载更新");return; }
        worker.execute(()->{
            try {
                JSONObject release=new JSONObject(readText("https://api.github.com/repos/"+UpdateConfig.REPOSITORY+"/releases/latest",1024*1024));
                if(release.optBoolean("draft")||release.optBoolean("prerelease")) return;
                String tag=release.getString("tag_name");
                JSONArray assets=release.getJSONArray("assets");
                String metadataUrl=findAsset(assets,"update.json");
                if(metadataUrl==null) { if(!silent)message("暂时没有可用更新");return; }
                JSONObject metadata=new JSONObject(readText(metadataUrl,128*1024));
                long next=metadata.getLong("versionCode");
                long current=version(activity.getPackageManager().getPackageInfo(activity.getPackageName(),0));
                if(next<=current) { if(!silent)message("当前已是最新版本 "+versionName());return; }
                String name=metadata.getString("apk"),sha=metadata.getString("sha256");
                if(!UpdatePolicy.validApkName(name)||!UpdatePolicy.validDigest(sha)) throw new Exception("更新信息不完整");
                String apkUrl=findAsset(assets,name);
                if(apkUrl==null)throw new Exception("新版安装包尚未发布");
                if(metadata.optInt("minSdk",26)>Build.VERSION.SDK_INT) { if(!silent)message("新版暂不支持当前安卓版本");return; }
                if(silent&&tag.equals(offeredTag))return;
                offeredTag=tag;
                String title=metadata.getString("versionName");
                String notes=release.optString("body","");
                if(notes.length()>1500)notes=notes.substring(0,1500);
                final String details="发现新版本 "+title+"\n\n"+notes;
                ui(()->new AlertDialog.Builder(activity).setTitle("更新翻页时钟").setMessage(details)
                    .setNegativeButton("稍后",null).setPositiveButton("下载更新",(d,w)->download(apkUrl,sha,next)).show());
            } catch(Exception e) {
                if(!silent)message("检查更新失败，请检查网络后重试");
            } finally { busy.set(false); }
        });
    }
    private String findAsset(JSONArray assets,String name)throws Exception {
        for(int i=0;i<assets.length();i++) {
            JSONObject asset=assets.getJSONObject(i);
            if(name.equals(asset.optString("name"))) {
                String url=asset.getString("browser_download_url");
                if(!UpdatePolicy.trustedAsset(url))throw new Exception("Invalid asset URL");
                return url;
            }
        }
        return null;
    }
    private HttpURLConnection connect(String target)throws Exception {
        String url=target;
        for(int i=0;i<8;i++) {
            if(!UpdatePolicy.trustedTransport(url))throw new Exception("Untrusted URL");
            HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent","FlipClock/"+versionName());
            c.setRequestProperty("Accept",url.startsWith("https://api.github.com/")?"application/vnd.github+json":"application/octet-stream");
            int code=c.getResponseCode();
            if(code==301||code==302||code==303||code==307||code==308) {
                String location=c.getHeaderField("Location");
                URL next=new URL(new URL(url),location);c.disconnect();url=next.toString();continue;
            }
            if(code!=200){c.disconnect();throw new Exception("HTTP "+code);}
            return c;
        }
        throw new Exception("Too many redirects");
    }
    private String readText(String url,int max)throws Exception {
        HttpURLConnection c=connect(url);
        try(InputStream input=c.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192];int n,total=0;
            while((n=input.read(buffer))!=-1){total+=n;if(total>max)throw new Exception("Metadata too large");output.write(buffer,0,n);}
            return new String(output.toByteArray(),StandardCharsets.UTF_8);
        } finally {c.disconnect();}
    }
    private void download(String url,String sha,long next) {
        if(!busy.compareAndSet(false,true)){message("正在下载更新");return;}
        message("正在下载更新，完成后会提示安装");
        worker.execute(()->{
            File partial=new File(activity.getCacheDir(),"update-download.tmp");
            File complete=new File(activity.getCacheDir(),"verified-update.apk");
            try {
                HttpURLConnection c=connect(url);
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                long total=0;
                try(InputStream input=c.getInputStream();FileOutputStream output=new FileOutputStream(partial)) {
                    byte[] buffer=new byte[16384];int n;
                    while((n=input.read(buffer))!=-1){total+=n;if(total>UpdatePolicy.MAX_APK_BYTES)throw new Exception("APK too large");digest.update(buffer,0,n);output.write(buffer,0,n);}
                } finally {c.disconnect();}
                if(!digestHex(digest.digest()).equalsIgnoreCase(sha))throw new Exception("Digest mismatch");
                verifyPackage(partial,next);
                if(complete.exists()&&!complete.delete())throw new Exception("Cannot replace cached APK");
                if(!partial.renameTo(complete))throw new Exception("Cannot save update");
                pendingVersion=next;pendingSha=sha;
                ui(()->new AlertDialog.Builder(activity).setTitle("更新已准备好").setMessage("安装包校验通过，是否现在安装？")
                    .setNegativeButton("稍后",null).setPositiveButton("安装",(d,w)->install()).show());
            } catch(Exception e) {partial.delete();message("下载或校验失败，请重新检查更新");}
            finally {busy.set(false);}
        });
    }
    private String digestHex(byte[] bytes) {
        StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();
    }
    private String[] signatures(PackageInfo info)throws Exception {
        Signature[] list=Build.VERSION.SDK_INT>=28&&info.signingInfo!=null?info.signingInfo.getApkContentsSigners():info.signatures;
        if(list==null||list.length==0)throw new Exception("Missing signature");
        String[] hashes=new String[list.length];
        for(int i=0;i<list.length;i++)hashes[i]=digestHex(MessageDigest.getInstance("SHA-256").digest(list[i].toByteArray()));
        Arrays.sort(hashes);return hashes;
    }
    private void verifyPackage(File file,long expected)throws Exception {
        PackageManager pm=activity.getPackageManager();
        PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),signatureFlags());
        PackageInfo candidate=pm.getPackageArchiveInfo(file.getAbsolutePath(),signatureFlags());
        if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||version(candidate)!=expected
            ||version(candidate)<=version(installed)||!Arrays.equals(signatures(installed),signatures(candidate)))throw new Exception("Invalid APK identity or version");
    }
    private void install() {
        if(!activity.getPackageManager().canRequestPackageInstalls()) {
            waitingForPermission=true;
            new AlertDialog.Builder(activity).setTitle("允许安装更新")
                .setMessage("请在安卓设置中允许翻页时钟安装应用，返回后继续安装。")
                .setNegativeButton("取消",(d,w)->waitingForPermission=false)
                .setPositiveButton("前往设置",(d,w)->activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())))).show();
            return;
        }
        File file=new File(activity.getCacheDir(),"verified-update.apk");
        try {
            verifyPackage(file,pendingVersion);
            if(pendingSha==null)throw new Exception("No verified update");
            Uri uri=Uri.parse("content://"+activity.getPackageName()+".updates/update.apk");
            Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent);
        } catch(Exception e) {message("无法安装更新，请重新下载后重试");}
    }
    void onResume() {
        if(waitingForPermission){waitingForPermission=false;if(activity.getPackageManager().canRequestPackageInstalls())install();}
    }
    void destroy(){worker.shutdownNow();}
}
