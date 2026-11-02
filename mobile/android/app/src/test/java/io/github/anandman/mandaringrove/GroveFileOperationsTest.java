package io.github.anandman.mandaringrove;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.UUID;

public class GroveFileOperationsTest {
    @Test public void duplicateOrOldCallbackCannotUnlockNewOperation() {
        GroveFileOperations operations = new GroveFileOperations();
        String first = operations.begin(); assertNull(operations.savedId()); operations.launched(first); assertEquals(first, operations.savedId()); assertTrue(operations.claim(first, false));
        assertFalse(operations.claim(first, false)); assertTrue(operations.isPending());
        assertTrue(operations.end(first)); String second = operations.begin();
        assertFalse(operations.claim(first, false)); assertFalse(operations.end(first));
        assertFalse(operations.end(null)); assertTrue(operations.isPending());
        assertTrue(operations.claim(second, false)); assertTrue(operations.end(second));
    }
    @Test public void restoredOperationCanBeClaimedOnceWithoutReplacingANewLocalRequest() {
        GroveFileOperations operations = new GroveFileOperations(); String restored = UUID.randomUUID().toString();
        assertFalse(operations.claim(null, true)); assertTrue(operations.claim(restored, true));
        assertThrows(IllegalStateException.class, operations::begin); assertTrue(operations.end(restored));
        assertFalse(operations.claim(restored, true)); String local = operations.begin();
        assertFalse(operations.claim(restored, true)); assertTrue(operations.isPending()); assertTrue(operations.end(local));
        GroveFileOperations saved = new GroveFileOperations(); saved.restore(restored);
        assertTrue(saved.isPending()); assertTrue(saved.claim(restored, true)); assertTrue(saved.end(restored));
    }
}
