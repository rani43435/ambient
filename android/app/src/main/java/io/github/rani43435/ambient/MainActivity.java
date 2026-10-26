package io.github.rani43435.ambient;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ambient Video for the Pocket TV: a full-screen browser (WebView) that adds the
 * Ambilight glow to any video it plays, YouTube included. The glow script
 * (assets/ambient.js) is injected into every page and every frame, and reads
 * the <video> directly, so no screen sharing is needed.
 */
public class MainActivity extends Activity {
    static final String HOME = "file:///android_asset/home.html";
    private static final int PICK_FILE = 1;

    private WebView web;
    private FrameLayout root, fullHolder;
    private View fullView;
    private WebChromeClient.CustomViewCallback fullCallback;
    private ValueCallback<Uri[]> fileCallback;
    private String script = "";
    private boolean docStart;
    private SharedPreferences prefs;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("ambient", MODE_PRIVATE);
        script = readAsset("ambient.js");

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        fullHolder = new FrameLayout(this);
        fullHolder.setBackgroundColor(Color.BLACK);
        fullHolder.setVisibility(View.GONE);
        root.addView(fullHolder, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        immersive();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "AmbientBridge");
        // Run the glow script in every page and every frame (iframe players too).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, script, Collections.singleton("*"));
            docStart = true;
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String scheme = r.getUrl().getScheme();
                // Stay in the app: ignore links that try to open other apps (intent://, vnd.youtube:, ...)
                return scheme == null || !(scheme.equals("http") || scheme.equals("https") || scheme.equals("file") || scheme.equals("blob") || scheme.equals("about"));
            }

            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap icon) {
                if (!docStart) v.evaluateJavascript(script, null);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                if (!docStart) v.evaluateJavascript(script, null); // older WebView: main frame only
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                if (fullView != null) { cb.onCustomViewHidden(); return; }
                fullView = view; fullCallback = cb;
                fullHolder.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                fullHolder.setVisibility(View.VISIBLE);
                immersive();
            }

            @Override
            public void onHideCustomView() { leaveFull(); }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("video/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Choose video"), PICK_FILE);
                } catch (Exception e) {
                    fileCallback = null; cb.onReceiveValue(null); return false;
                }
                return true;
            }

            @Override
            public android.graphics.Bitmap getDefaultVideoPoster() {
                // Avoid the grey "play" placeholder WebView shows before a video starts.
                return android.graphics.Bitmap.createBitmap(1, 1, android.graphics.Bitmap.Config.ARGB_8888);
            }
        });

        if (state != null) web.restoreState(state);
        else open(getIntent());
    }

    /** Open a link handed to the app (shared text or a YouTube link), else the home screen. */
    private void open(Intent i) {
        String url = null;
        if (i != null) {
            if (Intent.ACTION_VIEW.equals(i.getAction()) && i.getData() != null) url = i.getData().toString();
            else if (Intent.ACTION_SEND.equals(i.getAction())) {
                String t = i.getStringExtra(Intent.EXTRA_TEXT);
                if (t != null) {
                    Matcher m = Pattern.compile("https?://\\S+").matcher(t);
                    if (m.find()) url = m.group();
                }
            }
        }
        web.loadUrl(url != null ? url : HOME);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (Intent.ACTION_VIEW.equals(i.getAction()) || Intent.ACTION_SEND.equals(i.getAction())) open(i);
    }

    private void leaveFull() {
        if (fullView == null) return;
        fullHolder.removeView(fullView);
        fullHolder.setVisibility(View.GONE);
        fullView = null;
        if (fullCallback != null) fullCallback.onCustomViewHidden();
        fullCallback = null;
        immersive();
    }

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        switch (code) {
            case KeyEvent.KEYCODE_BACK:
                if (fullView != null) { leaveFull(); return true; }
                if (web.canGoBack()) { web.goBack(); return true; }
                if (!HOME.equals(web.getUrl())) { web.loadUrl(HOME); return true; }
                return super.onKeyDown(code, e);
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_SETTINGS:
            case KeyEvent.KEYCODE_INFO:
                // Glow settings panel on the video
                web.evaluateJavascript("window.__ambientPanel && window.__ambientPanel()", null);
                return true;
            case KeyEvent.KEYCODE_PROG_RED:
                web.evaluateJavascript("window.__ambientToggle && window.__ambientToggle()", null);
                return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                web.evaluateJavascript("(function(){var v=[].slice.call(document.querySelectorAll('video')).sort(function(a,b){return b.clientWidth-a.clientWidth})[0];if(v){v.paused?v.play():v.pause();}})()", null);
                return true;
        }
        return super.onKeyDown(code, e);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK_FILE && fileCallback != null) {
            Uri u = (res == RESULT_OK && data != null) ? data.getData() : null;
            fileCallback.onReceiveValue(u != null ? new Uri[]{u} : null);
            fileCallback = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (has) immersive();
    }

    @SuppressWarnings("deprecation")
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        if (Build.VERSION.SDK_INT >= 28) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); CookieManager.getInstance().flush(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); immersive(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        } catch (Exception e) { return ""; }
    }

    /** Glow settings shared by every page and frame (strength, size, on/off). */
    class Bridge {
        @JavascriptInterface public String get() { return prefs.getString("cfg", "{}"); }
        @JavascriptInterface public void set(String json) {
            if (json != null && json.length() < 500) prefs.edit().putString("cfg", json).apply();
        }
    }
}
