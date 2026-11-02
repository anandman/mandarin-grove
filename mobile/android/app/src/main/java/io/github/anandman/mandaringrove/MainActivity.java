package io.github.anandman.mandaringrove;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GroveFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
