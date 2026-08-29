package fun.subha.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Subha wraps a live WebRTC audio/video product, so the WebView needs two
 * things Capacitor doesn't wire up by default:
 *  1) The Android runtime permissions (CAMERA / RECORD_AUDIO) requested
 *     up front, so the browser-level getUserMedia() prompt isn't silently
 *     blocked by the OS.
 *  2) WebChromeClient.onPermissionRequest granting the matching WebView
 *     resources (audio/video capture) once those runtime permissions are
 *     held, since the WebView has no UI of its own to ask the user.
 */
public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    private static final String[] REQUIRED_PERMISSIONS = {
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.MODIFY_AUDIO_SETTINGS,
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestMissingPermissions();
        configureWebRtcPermissionBridge();
    }

    private void requestMissingPermissions() {
        java.util.List<String> missing = new java.util.ArrayList<>();
        for (String permission : REQUIRED_PERMISSIONS) {
            if (ContextCompat.checkSelfPermission(this, permission)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                missing.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
    }

    private void configureWebRtcPermissionBridge() {
        this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean hasCamera = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED;
                    boolean hasMic = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED;

                    java.util.List<String> granted = new java.util.ArrayList<>();
                    for (String resource : request.getResources()) {
                        if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE) && hasCamera) {
                            granted.add(resource);
                        } else if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && hasMic) {
                            granted.add(resource);
                        }
                    }

                    if (!granted.isEmpty()) {
                        request.grant(granted.toArray(new String[0]));
                    } else {
                        request.deny();
                    }
                });
            }
        });
    }
}
