package design.highgain.mandaringrove;

import java.nio.charset.StandardCharsets;

/** Bound the system text share below Binder limits; never truncate raw reports. */
final class GroveFeedbackText {
    static String validate(String text, boolean sharing) {
        int limit = sharing ? 64 * 1024 : 64 * 1024 * 1024;
        if (text == null || text.length() > limit || text.getBytes(StandardCharsets.UTF_8).length > limit)
            throw new IllegalArgumentException(sharing ? "This report is too large to share as text. Save the report file instead." : "This report exceeds the safe 64 MiB file limit. Your local report was kept.");
        return text;
    }
}
