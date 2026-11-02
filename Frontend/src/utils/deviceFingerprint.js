const KEY = 'device_fingerprint';

// Generates (or reads from localStorage) a stable device fingerprint
// based on browser/hardware characteristics. The same browser on the same
// device always produces the same value, so it can be used to bind a
// student account to their own device.
export const getDeviceFingerprint = () => {
  try {
    let fp = localStorage.getItem(KEY);
    if (!fp) {
      const raw = [
        navigator.userAgent,
        navigator.platform || '',
        navigator.language || '',
        `${screen.width}x${screen.height}`,
        String(screen.colorDepth),
        String(navigator.hardwareConcurrency || 4),
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      ].join('|');

      let hash = 5381;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) + hash + raw.charCodeAt(i)) >>> 0;
      }
      fp = `fp_${hash.toString(16)}`;
      localStorage.setItem(KEY, fp);
    }
    return fp;
  } catch (e) {
    return null;
  }
};
