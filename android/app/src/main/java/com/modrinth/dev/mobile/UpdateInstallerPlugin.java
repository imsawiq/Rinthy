package com.rinthy.mobile;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.URLUtil;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "UpdateInstaller")
public class UpdateInstallerPlugin extends Plugin {
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    private long activeDownloadId = -1L;
    private File activeApkFile;
    private PluginCall activeCall;
    private BroadcastReceiver downloadReceiver;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("APK URL is missing.");
            return;
        }

        if (activeCall != null) {
            call.reject("Another update is already downloading.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            openUnknownSourcesSettings();
            call.reject("Allow app installs from Rinthy, then tap Download again.");
            return;
        }

        String fallbackName = URLUtil.guessFileName(url, null, APK_MIME_TYPE);
        String fileName = sanitizeFileName(call.getString("fileName", fallbackName));
        if (!fileName.toLowerCase().endsWith(".apk")) {
            fileName = fileName + ".apk";
        }

        File downloadsDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDir == null) {
            call.reject("Android downloads directory is unavailable.");
            return;
        }

        if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
            call.reject("Could not create downloads directory.");
            return;
        }

        File apkFile = new File(downloadsDir, fileName);
        if (apkFile.exists() && !apkFile.delete()) {
            call.reject("Could not replace previous APK download.");
            return;
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(call.getString("title", "Rinthy update"));
            request.setDescription(fileName);
            request.setMimeType(APK_MIME_TYPE);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationUri(Uri.fromFile(apkFile));
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);

            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager == null) {
                call.reject("Android DownloadManager is unavailable.");
                return;
            }

            activeCall = call;
            activeCall.setKeepAlive(true);
            activeApkFile = apkFile;
            activeDownloadId = downloadManager.enqueue(request);
            registerDownloadReceiver();
        } catch (Exception e) {
            clearActiveDownload();
            call.reject("Could not start APK download.", e);
        }
    }

    private void registerDownloadReceiver() {
        if (downloadReceiver != null) return;

        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (downloadId != activeDownloadId) return;
                handleDownloadComplete();
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(downloadReceiver, filter);
        }
    }

    private void handleDownloadComplete() {
        PluginCall call = activeCall;
        File apkFile = activeApkFile;

        try {
            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager == null) {
                rejectAndClear(call, "Android DownloadManager is unavailable.");
                return;
            }

            DownloadManager.Query query = new DownloadManager.Query().setFilterById(activeDownloadId);
            try (Cursor cursor = downloadManager.query(query)) {
                if (cursor == null || !cursor.moveToFirst()) {
                    rejectAndClear(call, "APK download was not found.");
                    return;
                }

                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int status = cursor.getInt(statusIndex);
                if (status == DownloadManager.STATUS_FAILED) {
                    rejectAndClear(call, "APK download failed.");
                    return;
                }

                if (status != DownloadManager.STATUS_SUCCESSFUL) {
                    return;
                }
            }

            if (apkFile == null || !apkFile.exists()) {
                rejectAndClear(call, "Downloaded APK file is missing.");
                return;
            }

            openInstaller(apkFile);
            if (call != null) {
                JSObject result = new JSObject();
                result.put("started", true);
                call.resolve(result);
            }
            clearActiveDownload();
        } catch (Exception e) {
            rejectAndClear(call, "Could not open Android installer.", e);
        }
    }

    private void openInstaller(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
        );

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, APK_MIME_TYPE);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(installIntent);
    }

    private void openUnknownSourcesSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private String sanitizeFileName(String fileName) {
        String sanitized = fileName == null ? "rinthy-update.apk" : fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
        return sanitized.trim().isEmpty() ? "rinthy-update.apk" : sanitized;
    }

    private void rejectAndClear(PluginCall call, String message) {
        if (call != null) call.reject(message);
        clearActiveDownload();
    }

    private void rejectAndClear(PluginCall call, String message, Exception e) {
        if (call != null) call.reject(message, e);
        clearActiveDownload();
    }

    private void clearActiveDownload() {
        if (downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (IllegalArgumentException ignored) {
            }
        }

        downloadReceiver = null;
        activeDownloadId = -1L;
        activeApkFile = null;
        activeCall = null;
    }

    @Override
    protected void handleOnDestroy() {
        clearActiveDownload();
        super.handleOnDestroy();
    }
}
