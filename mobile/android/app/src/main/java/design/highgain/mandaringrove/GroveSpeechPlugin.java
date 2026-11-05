package design.highgain.mandaringrove;

import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Foreground system speech only: no microphone, files, account or network API. */
@CapacitorPlugin(name = "GroveSpeech")
public final class GroveSpeechPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<PluginCall> queries = new ArrayList<>();
    private TextToSpeech engine;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;
    private AudioManager.OnAudioFocusChangeListener focusListener;
    private boolean initialized, initializing, foreground = true, destroyed;
    private int initializationGeneration;
    private Request active;
    private static final class Request {
        final String id; final PluginCall call; Runnable timeout;
        Request(String id, PluginCall call) { this.id = id; this.call = call; }
    }
    @Override public void load() {
        audio = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        main.post(this::initialize);
    }
    private void initialize() {
        if (destroyed || initialized || initializing) return;
        if (engine != null) engine.shutdown();
        initializing = true; final int generation = ++initializationGeneration;
        try {
            engine = new TextToSpeech(getContext(), status -> main.post(() -> {
                if (destroyed || generation != initializationGeneration) return;
                initializing = false; initialized = status == TextToSpeech.SUCCESS; resolveQueries();
            }));
            main.postDelayed(() -> {
                if (initializing && generation == initializationGeneration) {
                    initializationGeneration++; initializing = false; initialized = false;
                    if (engine != null) engine.shutdown(); engine = null; resolveQueries();
                }
            }, 5000);
            engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { main.post(() -> finish(id, true, null)); }
                @Override public void onError(String id) { main.post(() -> finish(id, false, "error")); }
                @Override public void onError(String id, int code) { onError(id); }
                @Override public void onStop(String id, boolean interrupted) { main.post(() -> finish(id, false, "cancelled")); }
            });
        } catch (Exception error) { initializing = false; initialized = false; engine = null; resolveQueries(); }
    }
    private boolean validId(String id) {
        if (id == null) return false;
        try { return UUID.fromString(id).toString().equals(id); } catch (IllegalArgumentException error) { return false; }
    }
    private List<Voice> voices() {
        List<Voice> result = new ArrayList<>();
        if (!initialized || engine == null || engine.getVoices() == null) return result;
        for (Voice voice : engine.getVoices()) {
            if (voice.isNetworkConnectionRequired() || (voice.getFeatures() != null && voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) continue;
            if (voice.getName().length() > 512 || voice.getLocale().getDisplayName().length() > 256) continue;
            result.add(voice);
        }
        result.sort(Comparator.comparing(Voice::getName));
        return result.subList(0, Math.min(512, result.size()));
    }
    private JSObject catalog() {
        JSArray list = new JSArray();
        try {
            Voice defaultVoice = initialized && engine != null ? engine.getVoice() : null;
            for (Voice voice : voices()) list.put(new JSObject().put("voiceURI", voice.getName()).put("name", voice.getLocale().getDisplayName()).put("lang", voice.getLocale().toLanguageTag()).put("localService", true).put("default", defaultVoice != null && defaultVoice.getName().equals(voice.getName())));
        } catch (Exception error) { list = new JSArray(); }
        return new JSObject().put("voices", list).put("available", initialized);
    }
    private void resolveQueries() {
        if (queries.isEmpty()) return;
        JSObject result = catalog(); List<PluginCall> pending = new ArrayList<>(queries); queries.clear();
        for (PluginCall call : pending) call.resolve(result);
    }
    @PluginMethod public void getVoices(PluginCall call) {
        main.post(() -> {
            if (destroyed) { call.resolve(new JSObject().put("voices", new JSArray()).put("available", false)); return; }
            if (initialized) { call.resolve(catalog()); return; }
            if (queries.size() >= 8) { call.reject("The device voice list is busy. Try Refresh voices again."); return; }
            queries.add(call); initialize();
            main.postDelayed(() -> { if (queries.remove(call)) call.resolve(new JSObject().put("voices", new JSArray()).put("available", false)); }, 5000);
        });
    }
    private boolean matches(String lang, Locale voice) {
        String language = voice.getLanguage().toLowerCase(Locale.ROOT), country = voice.getCountry().toUpperCase(Locale.ROOT);
        if (lang.equals("en-US")) return language.equals("en");
        return (language.equals("zh") || language.equals("cmn")) && !country.equals("HK") && !country.equals("MO");
    }
    @PluginMethod public void speak(PluginCall call) {
        String id = call.getString("id"), text = call.getString("text"), lang = call.getString("lang"), uri = call.getString("voiceURI");
        double rate = call.getDouble("rate", 0.75);
        if (!validId(id) || text == null || text.trim().isEmpty() || text.length() > 2000 || !("zh-CN".equals(lang) || "en-US".equals(lang)) || uri == null || uri.length() > 512 || !Double.isFinite(rate) || rate < 0.5 || rate > 1.5) { call.reject("Invalid device speech request."); return; }
        main.post(() -> {
            if (!foreground || destroyed) { result(call, id, false, "background"); return; }
            if (!initialized || engine == null) { result(call, id, false, "unavailable"); return; }
            if (!cancelActive("cancelled")) { result(call, id, false, "error"); return; }
            try {
                Voice selected = null;
                for (Voice voice : voices()) if (voice.getName().equals(uri) && matches(lang, voice.getLocale())) { selected = voice; break; }
                if (selected == null) { result(call, id, false, "unavailable"); return; }
                if (engine.setVoice(selected) != TextToSpeech.SUCCESS || engine.setSpeechRate((float) rate) != TextToSpeech.SUCCESS) { result(call, id, false, "unavailable"); return; }
                engine.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                Request request = new Request(id, call); active = request;
                if (!gainFocus(id)) { finish(id, false, "error"); return; }
                request.timeout = () -> { if (active == request) forceCancel("error"); };
                main.postDelayed(request.timeout, Math.min(180000, Math.max(10000, (long) (text.length() * 250 / rate + 8000))));
                if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id) != TextToSpeech.SUCCESS) finish(id, false, "error");
            } catch (Exception error) { if (active != null && active.id.equals(id)) finish(id, false, "error"); else result(call, id, false, "error"); }
        });
    }
    private boolean gainFocus(String id) {
        focusListener = change -> main.post(() -> {
            if (change < 0 && active != null && active.id.equals(id)) {
                forceCancel("cancelled");
                notifyListeners("interrupted", new JSObject().put("reason", "audio-interruption"));
            }
        });
        if (audio == null) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(focusListener, main).build();
            return audio.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        return audio.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    private void abandonFocus() {
        if (audio != null) {
            if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audio.abandonAudioFocusRequest(focusRequest);
            else if (focusListener != null) audio.abandonAudioFocus(focusListener);
        }
        focusRequest = null; focusListener = null;
    }
    private void result(PluginCall call, String id, boolean spoken, String reason) {
        JSObject value = new JSObject().put("id", id).put("spoken", spoken); if (reason != null) value.put("reason", reason); call.resolve(value);
    }
    private void finish(String id, boolean spoken, String reason) {
        if (active == null || !active.id.equals(id)) return;
        Request old = active; active = null; if (old.timeout != null) main.removeCallbacks(old.timeout); abandonFocus(); result(old.call, id, spoken, reason);
    }
    private boolean cancelActive(String reason) {
        if (active == null) return true;
        try { if (engine != null && engine.stop() != TextToSpeech.SUCCESS) return false; }
        catch (Exception error) { return false; }
        finish(active.id, false, reason); return true;
    }
    private void forceCancel(String reason) {
        if (cancelActive(reason)) return;
        String id = active == null ? null : active.id;
        if (engine != null) engine.shutdown(); engine = null; initialized = false; initializing = false; initializationGeneration++;
        if (id != null) finish(id, false, "error");
    }
    @PluginMethod public void stop(PluginCall call) {
        String id = call.getString("id");
        if (id != null && !validId(id)) { call.reject("Invalid device speech identifier."); return; }
        main.post(() -> {
            if (active != null && (id == null || active.id.equals(id)) && !cancelActive("cancelled")) { call.reject("Could not stop the device voice. Try again."); return; }
            call.resolve();
        });
    }
    @Override protected void handleOnPause() {
        main.post(() -> {
            foreground = false;
            forceCancel("cancelled");
        });
    }
    @Override protected void handleOnResume() { main.post(() -> { foreground = true; initialize(); }); }
    @Override protected void handleOnDestroy() {
        main.post(() -> { destroyed = true; foreground = false; if (active != null) finish(active.id, false, "cancelled"); if (engine != null) { engine.stop(); engine.shutdown(); } engine = null; initialized = false; initializing = false; initializationGeneration++; resolveQueries(); });
    }
}
