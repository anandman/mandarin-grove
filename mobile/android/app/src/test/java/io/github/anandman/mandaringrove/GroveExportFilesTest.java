package io.github.anandman.mandaringrove;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class GroveExportFilesTest {
    @Test public void exactUtf8AndSelectedBackupSurviveDiscardAndClear() throws Exception {
        File base = Files.createTempDirectory("grove-staging-test-").toFile();
        GroveExportFiles files = new GroveExportFiles(new File(base, "private-staging"));
        byte[] expected = "\ufeff\n合成 backup\r\n".getBytes(StandardCharsets.UTF_8);
        File staged = files.stage(new String(expected, StandardCharsets.UTF_8));
        assertArrayEquals(expected, Files.readAllBytes(staged.toPath()));
        File selected = new File(base, "selected-backup.txt"); Files.copy(staged.toPath(), selected.toPath());
        files.discard(staged.getName()); files.discard(staged.getName()); assertFalse(staged.exists());
        File second = files.stage("synthetic second copy"), third = files.stage("synthetic abandoned copy");
        files.clear(); assertFalse(second.exists()); assertFalse(third.exists());
        assertArrayEquals(expected, Files.readAllBytes(selected.toPath()));
        assertThrows(IOException.class, () -> files.discard("../selected-backup.txt"));
        assertArrayEquals(expected, Files.readAllBytes(selected.toPath()));
    }
    @Test public void unknownFilesAndSymlinksArePreservedAndBlockCleanup() throws Exception {
        File base = Files.createTempDirectory("grove-staging-guard-test-").toFile(), root = new File(base, "private-staging");
        GroveExportFiles files = new GroveExportFiles(root); File staged = files.stage("synthetic private copy");
        File unknown = new File(root, "unrecognized-original.txt"); Files.write(unknown.toPath(), "keep unknown original".getBytes(StandardCharsets.UTF_8));
        assertThrows(IOException.class, files::clear); assertTrue(staged.exists()); assertTrue(unknown.exists());
        File otherRoot = new File(base, "symlink-staging"); otherRoot.mkdir();
        File selected = new File(base, "selected-backup.txt"); Files.write(selected.toPath(), "keep selected original".getBytes(StandardCharsets.UTF_8));
        File link = new File(otherRoot, "export-synthetic.utf8"); Files.createSymbolicLink(link.toPath(), selected.toPath());
        GroveExportFiles linked = new GroveExportFiles(otherRoot);
        assertThrows(IOException.class, linked::clear); assertThrows(IOException.class, () -> linked.discard(link.getName()));
        assertEquals("keep selected original", new String(Files.readAllBytes(selected.toPath()), StandardCharsets.UTF_8)); assertTrue(Files.isSymbolicLink(link.toPath()));
    }
}
