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
    private String defaultUA;
    // youtube.com/tv only opens for TVs; this is a Samsung TV browser's user agent.
    static final String TV_UA = "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36";

    static boolean isYtTv(String url) {
        return url != null && url.matches("^https?://(www\\.)?youtube\\.com/tv.*");
    }

    /** Load a URL with the right user agent (TV agent only for the YouTube TV interface). */
    private void go(String url) {
        String ua = isYtTv(url) ? TV_UA : defaultUA;
        if (!ua.equals(web.getSettings().getUserAgentString())) web.getSettings().setUserAgentString(ua);
        web.loadUrl(url);
    }

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
        defaultUA = s.getUserAgentString();
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
                String u = r.getUrl().toString();
                if (r.isForMainFrame()) { String t = toYtTv(u); if (!t.equals(u)) { go(t); return true; } }
                // Switch user agent when going into or out of the YouTube TV interface.
                if (r.isForMainFrame() && ("http".equals(scheme) || "https".equals(scheme) || "file".equals(scheme))) {
                    String want = isYtTv(u) ? TV_UA : defaultUA;
                    if (!want.equals(v.getSettings().getUserAgentString())) { go(u); return true; }
                }
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

    /** youtube.com/watch?v=ID, youtu.be/ID, shorts… → the same video in the YouTube TV interface. */
    static String toYtTv(String url) {
        if (url == null || isYtTv(url)) return url;
        Matcher h = Pattern.compile("^https?://(www\\.|m\\.)?(youtube\\.com|youtu\\.be)(/|$)").matcher(url);
        if (!h.find()) return url;
        Matcher m = Pattern.compile("(?:v=|youtu\\.be/|shorts/|embed/|live/)([\\w-]{11})").matcher(url);
        return m.find() ? "https://www.youtube.com/tv#/watch?v=" + m.group(1) : "https://www.youtube.com/tv";
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
        go(url != null ? toYtTv(url) : HOME);
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
                if (!HOME.equals(web.getUrl())) { go(HOME); return true; }
                return super.onKeyDown(code, e);
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_SETTINGS:
            case KeyEvent.KEYCODE_INFO:
                // Glow settings panel on the video
                showPanel();
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

    private android.app.Dialog panel;

    /** Glow settings as a native window: works with the remote on every site (YouTube TV too). */
    private void showPanel() {
        if (panel != null && panel.isShowing()) { panel.dismiss(); return; }
        org.json.JSONObject c;
        try { c = new org.json.JSONObject(prefs.getString("cfg", "{}")); } catch (Exception e) { c = new org.json.JSONObject(); }
        final org.json.JSONObject cfg = c;
        float d = getResources().getDisplayMetrics().density;
        android.widget.LinearLayout box = new android.widget.LinearLayout(this);
        box.setOrientation(android.widget.LinearLayout.VERTICAL);
        int pad = (int) (22 * d);
        box.setPadding(pad, pad, pad, pad);
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setColor(0xF0141518); bg.setCornerRadius(18 * d); bg.setStroke((int) d, 0xFF34373D);
        box.setBackground(bg);

        android.widget.CheckBox on = new android.widget.CheckBox(this);
        on.setText("Ambient glow");
        on.setTextColor(0xFFF2F2EF); on.setTextSize(18);
        on.setButtonTintList(android.content.res.ColorStateList.valueOf(0xFF7FE3B0));
        on.setChecked(cfg.optBoolean("on", true));
        box.addView(on);
        android.widget.SeekBar amount = slider(box, "Strength", 0, 100, cfg.optInt("amount", 100), d);
        android.widget.SeekBar size = slider(box, "Video size", 50, 100, cfg.optInt("size", 80), d);
        android.widget.TextView hint = new android.widget.TextView(this);
        hint.setText("Left / right to change · Back to close");
        hint.setTextColor(0xFF9A9DA4); hint.setTextSize(13);
        hint.setPadding(0, (int) (14 * d), 0, 0);
        box.addView(hint);

        Runnable push = () -> {
            try {
                cfg.put("on", on.isChecked());
                cfg.put("amount", amount.getProgress());
                cfg.put("size", 50 + size.getProgress());
            } catch (Exception ignored) {}
            prefs.edit().putString("cfg", cfg.toString()).apply();
            web.evaluateJavascript("window.__ambientReload && window.__ambientReload()", null);
        };
        on.setOnCheckedChangeListener((b, v) -> push.run());
        android.widget.SeekBar.OnSeekBarChangeListener l = new android.widget.SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(android.widget.SeekBar s, int p, boolean u) { push.run(); }
            public void onStartTrackingTouch(android.widget.SeekBar s) {}
            public void onStopTrackingTouch(android.widget.SeekBar s) {}
        };
        amount.setOnSeekBarChangeListener(l);
        size.setOnSeekBarChangeListener(l);

        panel = new android.app.Dialog(this);
        panel.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
        panel.setContentView(box);
        android.view.Window w = panel.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT));
            w.setLayout((int) (380 * d), ViewGroup.LayoutParams.WRAP_CONTENT);
            w.setGravity(android.view.Gravity.TOP | android.view.Gravity.START);
            WindowManager.LayoutParams a = w.getAttributes();
            a.x = (int) (24 * d); a.y = (int) (24 * d); a.dimAmount = 0f;
            w.setAttributes(a);
            w.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        }
        panel.setOnDismissListener((x) -> immersive());
        panel.show();
        amount.requestFocus();
    }

    private android.widget.SeekBar slider(android.widget.LinearLayout box, String label, int min, int max, int value, float d) {
        android.widget.TextView t = new android.widget.TextView(this);
        t.setText(label); t.setTextColor(0xFFF2F2EF); t.setTextSize(16);
        t.setPadding(0, (int) (16 * d), 0, (int) (4 * d));
        box.addView(t);
        android.widget.SeekBar s = new android.widget.SeekBar(this);
        s.setMax(max - min);
        s.setKeyProgressIncrement(5);
        s.setProgress(Math.max(0, Math.min(max - min, value - min)));
        s.setProgressTintList(android.content.res.ColorStateList.valueOf(0xFF7FE3B0));
        s.setThumbTintList(android.content.res.ColorStateList.valueOf(0xFF7FE3B0));
        s.setFocusable(true);
        box.addView(s, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (int) (40 * d)));
        return s;
    }

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
        @JavascriptInterface public void panel() { runOnUiThread(MainActivity.this::showPanel); }
    }
}
