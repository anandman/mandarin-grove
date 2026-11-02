package io.github.anandman.mandaringrove;

import java.io.*;
import java.nio.charset.StandardCharsets;

/** Only app-generated export tokens under the fixed private staging folder. */
final class GroveExportFiles {
    private final File root;
    GroveExportFiles(File root) { this.root = root; }
    private File directory() throws IOException {
        File expected = new File(root.getParentFile().getCanonicalFile(), root.getName());
        if (!root.getCanonicalFile().equals(expected)) throw new IOException("Unrecognized staging directory; original files were kept.");
        return expected;
    }
    private File token(String token) throws IOException {
        if (token == null || !token.matches("export-[A-Za-z0-9-]+[.]utf8")) throw new IOException("Unrecognized export token; original files were kept.");
        File expected = new File(directory(), token);
        if (!expected.getCanonicalFile().equals(expected) || expected.isDirectory()) throw new IOException("Unrecognized staging file; original files were kept.");
        return expected;
    }
    File stage(String text) throws IOException {
        File directory = directory();
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Private export staging is unavailable.");
        File staged = File.createTempFile("export-", ".utf8", directory);
        try (FileOutputStream out = new FileOutputStream(staged); Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
            writer.write(text); writer.flush(); out.getFD().sync();
        } catch (IOException error) {
            try { discard(staged.getName()); } catch (IOException cleanup) { error.addSuppressed(cleanup); }
            throw error;
        }
        return staged;
    }
    File file(String token) throws IOException { return token(token); }
    void discard(String token) throws IOException {
        File file = token(token);
        if (file.exists() && !file.delete()) throw new IOException("The private temporary backup could not be removed.");
    }
    void clear() throws IOException {
        File directory = directory(); if (!directory.exists()) return;
        File[] files = directory.listFiles();
        if (files == null) throw new IOException("Private export staging could not be inspected.");
        // Validate the entire scope before removing even one known copy.
        for (File file : files) token(file.getName());
        for (File file : files) discard(file.getName());
    }
}
