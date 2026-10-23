import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const MAX_WEB_EDGE = 1600;

/**
 * Let the user pick a photo for their Liquid Glass background. Resolves to a
 * persistable URI, or null if they cancelled.
 *  - Web: downscaled to a JPEG data URL so it fits comfortably in localStorage.
 *  - Native: copied into the app's Documents folder; the picker's own file lives
 *    in a cache directory the OS may clear.
 */
export async function pickBackgroundPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const uri = result.assets[0].uri;
  return Platform.OS === 'web' ? downscaleForWeb(uri) : persistNative(uri);
}

function downscaleForWeb(uri: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_WEB_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(uri);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}

function persistNative(uri: string): string {
  try {
    // Required lazily so the web bundle never loads the native module.
    const { File, Directory, Paths } = require('expo-file-system');
    const dir = new Directory(Paths.document, 'backgrounds');
    if (dir.exists) {
      // Only one custom background is kept at a time.
      for (const entry of dir.list()) entry.delete();
    } else {
      dir.create();
    }
    const dest = new File(dir, `background-${Date.now()}.jpg`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}
