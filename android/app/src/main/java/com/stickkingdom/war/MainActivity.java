package com.stickkingdom.war;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 막대 왕국 전쟁 - 웹 게임을 감싸는 전체화면 WebView 액티비티.
 * 게임 파일은 assets/www 에 들어 있고 오프라인으로 동작한다.
 */
public class MainActivity extends Activity {

    private WebView web;
    private String pendingExport;
    private static final int EXPORT_SAVE = 41, IMPORT_SAVE = 42;
    private static final int SAVE_LIMIT = 1024 * 1024;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage 로 진행도를 저장한다
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setTextZoom(100);                    // 시스템 글꼴 크기에 레이아웃이 흔들리지 않게

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // The JavaScript bridge is available only to bundled game pages.
                return !request.getUrl().toString().startsWith("file:///android_asset/www/");
            }
        });
        web.addJavascriptInterface(new SaveBridge(), "AndroidSave");
        web.setBackgroundColor(0xFF171A1F);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        setContentView(web);
        hideSystemBars();

        web.loadUrl("file:///android_asset/www/index.html");
    }

    public class SaveBridge {
        @JavascriptInterface public void exportSave(String json) {
            if (json == null || json.getBytes(StandardCharsets.UTF_8).length > SAVE_LIMIT) return;
            runOnUiThread(() -> {
                pendingExport = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "stick-kingdom-backup.json");
                try { startActivityForResult(intent, EXPORT_SAVE); }
                catch (Exception e) { backupMessage("파일 선택기를 열지 못했습니다. 백업 텍스트를 복사해 주세요."); }
            });
        }
        @JavascriptInterface public void importSave() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try { startActivityForResult(intent, IMPORT_SAVE); }
                catch (Exception e) { backupMessage("파일 선택기를 열지 못했습니다. 백업 텍스트를 붙여 넣어 주세요."); }
            });
        }
    }

    private void backupMessage(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) {
            if (request == EXPORT_SAVE) pendingExport = null;
            return;
        }
        try {
            if (request == EXPORT_SAVE) {
                if (pendingExport == null) { backupMessage("백업을 다시 내보내 주세요."); return; }
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (out == null) throw new Exception("No output stream");
                    out.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                }
                pendingExport = null;
                backupMessage("백업 파일을 저장했습니다.");
            } else if (request == IMPORT_SAVE) {
                String json;
                try (InputStream in = getContentResolver().openInputStream(data.getData());
                     ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    if (in == null) throw new Exception("No input stream");
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        if (bytes.size() + n > SAVE_LIMIT) throw new Exception("Backup too large");
                        bytes.write(buffer, 0, n);
                    }
                    json = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
                }
                if (web != null) web.evaluateJavascript("window.receiveSaveBackup(" + JSONObject.quote(json) + ")", null);
            }
        } catch (Exception e) {
            pendingExport = null;
            backupMessage("백업 파일 처리에 실패했습니다. 기존 진행도는 변경하지 않았습니다.");
        }
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** 뒤로 가기: 게임이 처리하면 맡기고, 타이틀에서는 앱을 닫는다. */
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
            "(function(){return (window.__androidBack && window.__androidBack()) ? '1' : '0';})()",
            value -> {
                if (value == null || !value.contains("1")) finish();
            });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.evaluateJavascript("window.__androidPause && window.__androidPause()", null);
            web.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
