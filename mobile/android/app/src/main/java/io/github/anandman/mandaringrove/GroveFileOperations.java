package io.github.anandman.mandaringrove;

import java.util.UUID;

/** A callback may claim and finish only its own live or restored operation. */
final class GroveFileOperations {
    private String active;
    private boolean started, claimed, launched;
    synchronized boolean isPending() { return active != null; }
    synchronized String savedId() { return launched ? active : null; }
    synchronized void launched(String id) { if (id != null && id.equals(active)) launched = true; }
    synchronized String begin() {
        if (active != null) throw new IllegalStateException("Finish the current file picker first.");
        active = UUID.randomUUID().toString(); started = true; claimed = false; launched = false; return active;
    }
    synchronized void restore(String id) {
        if (started || id == null) return;
        try { if (!UUID.fromString(id).toString().equals(id)) return; }
        catch (IllegalArgumentException error) { return; }
        active = id; started = true; claimed = false; launched = true;
    }
    synchronized boolean claim(String id, boolean restored) {
        if (!started && restored) restore(id);
        if (id == null || !id.equals(active) || claimed) return false;
        claimed = true; return true;
    }
    synchronized boolean end(String id) {
        if (id == null || !id.equals(active)) return false;
        active = null; claimed = false; launched = false; return true;
    }
}
