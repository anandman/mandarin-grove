package io.github.anandman.mandaringrove;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

@CapacitorPlugin(name = "GroveFiles")
public class GroveFilesPlugin extends Plugin {
    private static final int LIMIT = 64 * 1024 * 1024;
    private boolean pickerPending;
    private byte[] readBounded(InputStream input) throws Exception {
        if (input == null) throw new IOException("The selected document is unavailable.");
        try (InputStream stream = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16384]; int size;
            while ((size = stream.read(buffer)) != -1) {
                if (out.size() + size > LIMIT) throw new IOException("This file exceeds the safe 64 MiB export/preview limit. The original was kept.");
                out.write(buffer, 0, size);
            }
            return out.toByteArray();
        }
    }
    @PluginMethod public void installationIdentity(PluginCall call) {
        try {
            File file = new File(getContext().getNoBackupFilesDir(), "grove-installation-identity");
            if (!file.exists()) {
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(UUID.randomUUID().toString().getBytes(StandardCharsets.UTF_8)); out.getFD().sync();
                }
            }
            String id = new String(readBounded(new FileInputStream(file)), StandardCharsets.UTF_8);
            if (!UUID.fromString(id).toString().equals(id)) throw new IOException("Installation identity needs recovery; its original file was kept.");
            call.resolve(new JSObject().put("id", id));
        } catch (Exception error) { call.reject("Could not prepare private installation storage. Existing files were kept.", error); }
    }
    @PluginMethod public void saveText(PluginCall call) {
        String name = call.getString("name"), text = call.getString("text"), mime = call.getString("mimeType", "text/plain");
        if (name == null || !name.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,119}") || text == null || !(mime.equals("text/plain") || mime.equals("application/json"))) { call.reject("Invalid backup file request."); return; }
        if (pickerPending) { call.reject("Finish the current file picker first."); return; }
        try {
            // Capacitor persists pending call options in the Activity Bundle.
            // A backup must never enter that size-limited state (or its logs).
            // Keep the payload in private, non-backed-up staging and only a
            // generated basename in the saved callback options.
            File directory = new File(getContext().getNoBackupFilesDir(), "grove-pending-exports");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Private export staging is unavailable.");
            File staged = File.createTempFile("export-", ".utf8", directory);
            try (FileOutputStream out = new FileOutputStream(staged); Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
                writer.write(text); writer.flush(); out.getFD().sync();
            }
            call.getData().remove("text"); call.getData().put("groveExportToken", staged.getName());
            pickerPending = true;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(call, intent, "savedDocument");
        }
        catch (Exception error) { pickerPending = false; call.reject("Could not open the system file picker.", error); }
    }
    @ActivityCallback private void savedDocument(PluginCall call, ActivityResult result) {
        pickerPending = false; if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) { call.resolve(new JSObject().put("saved", false)); return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) { call.reject("No backup destination was selected."); return; }
        String token = call.getString("groveExportToken");
        if (token == null || !token.matches("export-[A-Za-z0-9-]+[.]utf8")) { call.reject("The prepared export is unavailable. All progress was kept; try exporting again."); return; }
        File staged = new File(new File(getContext().getNoBackupFilesDir(), "grove-pending-exports"), token);
        try (InputStream input = new FileInputStream(staged); OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("The selected destination is unavailable.");
            byte[] buffer = new byte[16384]; int count;
            while ((count = input.read(buffer)) != -1) out.write(buffer, 0, count);
            out.flush();
        } catch (Exception error) { call.reject("Could not finish writing the backup file. Progress was kept.", error); return; }
        call.resolve(new JSObject().put("saved", true));
    }
    @PluginMethod public void openText(PluginCall call) {
        if (pickerPending) { call.reject("Finish the current file picker first."); return; }
        pickerPending = true;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain");
        try { startActivityForResult(call, intent, "openedDocument"); }
        catch (Exception error) { pickerPending = false; call.reject("Could not open the system file picker.", error); }
    }
    @ActivityCallback private void openedDocument(PluginCall call, ActivityResult result) {
        pickerPending = false; if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) { call.resolve(new JSObject().put("cancelled", true)); return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) { call.reject("No backup file was selected."); return; }
        try {
            byte[] data = readBounded(getContext().getContentResolver().openInputStream(uri));
            String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString();
            call.resolve(new JSObject().put("cancelled", false).put("text", text));
        } catch (Exception error) { call.reject("Could not read a valid UTF-8 backup. The original and progress were kept.", error); }
    }
    @PluginMethod public void rawRecovery(PluginCall call) {
        try {
            JSArray files = new JSArray();
            for (String suffix : new String[]{"", "-wal", "-shm"}) {
                String name = "mandarin_groveSQLite.db" + suffix; File file = getContext().getDatabasePath(name);
                if (!file.exists()) continue;
                byte[] data = readBounded(new FileInputStream(file)); StringBuilder hash = new StringBuilder();
                for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) hash.append(String.format("%02x", b & 255));
                files.put(new JSObject().put("name", name).put("base64", Base64.encodeToString(data, Base64.NO_WRAP)).put("sha256", hash.toString()));
            }
            if (files.length() == 0) throw new IOException("No native database files were found. Nothing was erased or replaced.");
            call.resolve(new JSObject().put("format", "mandarin-grove-native-files-v1").put("files", files));
        } catch (Exception error) { call.reject("Could not export the original recovery files. All originals were kept.", error); }
    }
}
