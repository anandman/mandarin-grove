package io.github.anandman.mandaringrove;

import org.junit.Test;
import static org.junit.Assert.*;

public class GroveFeedbackTextTest {
    @Test public void shareBoundUsesUtf8BytesAndNeverTruncatesTheReport() {
        String exact = "保".repeat(21845) + "a";
        assertEquals(exact, GroveFeedbackText.validate(exact, true));
        assertThrows(IllegalArgumentException.class, () -> GroveFeedbackText.validate(exact + "a", true));
        assertThrows(IllegalArgumentException.class, () -> GroveFeedbackText.validate(null, true));
    }
    @Test public void localFileAllowsTheFullReportBeyondShareLimitAndPreservesItsText() {
        String raw = "\ufeff\n合成\r\n" + "保".repeat(30000);
        assertEquals(raw, GroveFeedbackText.validate(raw, false));
        assertThrows(IllegalArgumentException.class, () -> GroveFeedbackText.validate("x".repeat(64 * 1024 * 1024 + 1), false));
    }
}
