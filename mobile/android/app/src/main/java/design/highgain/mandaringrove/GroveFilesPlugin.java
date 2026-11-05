package design.highgain.mandaringrove;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
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
    private final GroveFileOperations operations = new GroveFileOperations();
    private static final String OPERATION = "grovePickerOperation";
    private GroveExportFiles exports() { return new GroveExportFiles(new File(getContext().getNoBackupFilesDir(), "grove-pending-exports")); }
    @Override protected Bundle saveInstanceState() {
        Bundle state = super.saveInstanceState(); String id = operations.savedId();
        if (state != null && id != null) state.putString(OPERATION, id);
        return state;
    }
    @Override protected void restoreState(Bundle state) {
        super.restoreState(state); if (state != null) operations.restore(state.getString(OPERATION));
    }
    private boolean claim(PluginCall call, String method) {
        if (call == null || !method.equals(call.getMethodName())) return false;
        String id = call.getString(OPERATION); boolean restored = PluginCall.CALLBACK_ID_DANGLING.equals(call.getCallbackId());
        if (id == null && restored && !operations.isPending()) call.reject("The file picker was interrupted. Choose the file again. Progress and original files were kept.");
        return operations.claim(id, restored);
    }
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
    @PluginMethod public synchronized void saveText(PluginCall call) {
        String name = call.getString("name"), text = call.getString("text"), mime = call.getString("mimeType", "text/plain");
        if (name == null || !name.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,119}") || text == null || !(mime.equals("text/plain") || mime.equals("application/json"))) { call.reject("Invalid backup file request."); return; }
        if (operations.isPending()) { call.reject("Finish the current file picker first."); return; }
        String operation = operations.begin(); call.getData().put(OPERATION, operation);
        File staged = null;
        try {
            // Capacitor persists pending call options in the Activity Bundle.
            // A backup must never enter that size-limited state (or its logs).
            // Keep the payload in private, non-backed-up staging and only a
            // generated basename in the saved callback options.
            staged = exports().stage(text);
            call.getData().remove("text"); call.getData().put("groveExportToken", staged.getName());
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(call, intent, "savedDocument");
            operations.launched(operation);
        }
        catch (Exception error) {
            operations.end(operation);
            if (staged != null) try { exports().discard(staged.getName()); } catch (Exception cleanup) { error.addSuppressed(cleanup); }
            call.reject("Could not open the system file picker. Progress was kept.", error);
        }
    }
    @PluginMethod public synchronized void saveFeedback(PluginCall call) {
        try { GroveFeedbackText.validate(call.getString("text"), false); }
        catch (IllegalArgumentException error) { call.reject(error.getMessage()); return; }
        call.getData().put("name", "mandarin-grove-feedback.txt"); call.getData().put("mimeType", "text/plain");
        saveText(call);
    }
    @PluginMethod public synchronized void shareFeedback(PluginCall call) {
        String text;
        try { text = GroveFeedbackText.validate(call.getString("text"), true); }
        catch (IllegalArgumentException error) { call.reject(error.getMessage()); return; }
        if (operations.isPending()) { call.reject("Finish the current file or share action first."); return; }
        String operation = operations.begin(); call.getData().put(OPERATION, operation);
        // Saved callback options contain only ownership metadata, never the report.
        call.getData().remove("text");
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text).putExtra(Intent.EXTRA_TITLE, "Mandarin Grove feedback");
        try { startActivityForResult(call, Intent.createChooser(send, null), "sharedFeedback"); operations.launched(operation); }
        catch (Exception error) { operations.end(operation); call.reject("Could not open the system share sheet. Your local reports were kept."); }
    }
    @ActivityCallback private synchronized void sharedFeedback(PluginCall call, ActivityResult result) {
        if (!claim(call, "shareFeedback")) return;
        operations.end(call.getString(OPERATION));
        // Android result codes do not establish delivery to the chosen recipient.
        call.resolve(new JSObject().put("closed", true));
    }
    @ActivityCallback private synchronized void savedDocument(PluginCall call, ActivityResult result) {
        if (call == null || !("saveText".equals(call.getMethodName()) || "saveFeedback".equals(call.getMethodName())) || !claim(call, call.getMethodName())) return;
        String operation = call.getString(OPERATION);
        getBridge().execute(() -> {
            String token = call.getString("groveExportToken"); boolean saved = false;
            Exception writeError = null, cleanupError = null;
            try {
                File staged = exports().file(token);
                if (result.getResultCode() == Activity.RESULT_OK) {
                    Uri uri = result.getData() == null ? null : result.getData().getData();
                    if (uri == null) throw new IOException("No file destination was selected.");
                    try (InputStream input = new FileInputStream(staged); OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                        if (out == null) throw new IOException("The selected destination is unavailable.");
                        byte[] buffer = new byte[16384]; int count;
                        while ((count = input.read(buffer)) != -1) out.write(buffer, 0, count);
                        out.flush();
                    }
                    saved = true;
                }
            } catch (Exception error) { writeError = error; }
            try { exports().discard(token); } catch (Exception error) { cleanupError = error; }
            operations.end(operation);
            if (cleanupError != null) call.reject(saved ? "The file was saved, but its private temporary copy could not be removed. Your progress is unchanged." : "Could not remove the private temporary file. Progress was kept.", saved ? "GROVE_EXPORT_SAVED" : "GROVE_EXPORT_STAGING", cleanupError);
            else if (writeError != null) call.reject("Could not finish writing the file. Progress was kept.", writeError);
            else call.resolve(new JSObject().put("saved", saved));
        });
    }
    @PluginMethod public synchronized void clearTemporaryFiles(PluginCall call) {
        if (operations.isPending()) { call.reject("Finish the current file picker before erasing this device."); return; }
        try { exports().clear(); call.resolve(); }
        catch (Exception error) { call.reject("Could not remove all private temporary backups. Progress has not been erased.", error); }
    }
    @PluginMethod public synchronized void openText(PluginCall call) {
        if (operations.isPending()) { call.reject("Finish the current file picker first."); return; }
        String operation = operations.begin(); call.getData().put(OPERATION, operation);
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain");
        try { startActivityForResult(call, intent, "openedDocument"); operations.launched(operation); }
        catch (Exception error) { operations.end(operation); call.reject("Could not open the system file picker.", error); }
    }
    @ActivityCallback private synchronized void openedDocument(PluginCall call, ActivityResult result) {
        if (!claim(call, "openText")) return;
        String operation = call.getString(OPERATION);
        getBridge().execute(() -> {
            JSObject response = null; Exception readError = null;
            try {
                if (result.getResultCode() != Activity.RESULT_OK) response = new JSObject().put("cancelled", true);
                else {
                    Uri uri = result.getData() == null ? null : result.getData().getData();
                    if (uri == null) throw new IOException("No backup file was selected.");
                    byte[] data = readBounded(getContext().getContentResolver().openInputStream(uri));
                    String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(data)).toString();
                    response = new JSObject().put("cancelled", false).put("text", text);
                }
            } catch (Exception error) { readError = error; }
            operations.end(operation);
            if (readError != null) call.reject("Could not read a valid UTF-8 backup. The original and progress were kept.", readError);
            else call.resolve(response);
        });
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
