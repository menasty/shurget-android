/**
 * Shurget Capacitor Native Bridge
 * Injected into the WebView — wires native plugins to the web app
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// ── Push Notifications ────────────────────────────────────────────────────────
export async function initPushNotifications() {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    // Send FCM token to Shurget backend
    fetch('https://shurgetapp.com/api/device/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.value, platform: 'android' }),
      credentials: 'include',
    }).catch(() => {});
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Received:', notification.title);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    // Deep link into the right page based on notification data
    const data = action.notification.data;
    if (data?.orderId) {
      window.location.href = `https://shurgetapp.com/track/${data.orderId}`;
    } else if (data?.url) {
      window.location.href = data.url;
    }
  });
}

// ── Geolocation ───────────────────────────────────────────────────────────────
export async function getNativeLocation() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (e) {
    return null;
  }
}

// Replace browser geolocation with native for driver GPS ping
export function patchGeolocation() {
  if (window.Capacitor?.isNativePlatform()) {
    navigator.geolocation.getCurrentPosition = (success, error, options) => {
      getNativeLocation().then((pos) => {
        if (pos) {
          success({
            coords: { latitude: pos.lat, longitude: pos.lng, accuracy: 10 },
            timestamp: Date.now(),
          });
        } else if (error) {
          error({ code: 2, message: 'Location unavailable' });
        }
      });
    };
  }
}

// ── Camera ────────────────────────────────────────────────────────────────────
export async function takePicture() {
  const image = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt, // lets user choose camera or gallery
  });
  return image.dataUrl;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('deviceready', () => {
  initPushNotifications();
  patchGeolocation();
  // Expose camera globally so web app forms can call it
  window.shurgetCamera = { takePicture };
});
