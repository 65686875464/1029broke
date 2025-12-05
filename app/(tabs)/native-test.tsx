import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, Image, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
// Import legacy FileSystem to avoid deprecated-method warnings for downloadAsync/copyAsync
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export default function NativeTest() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<any>(null);
  const [prettyAddress, setPrettyAddress] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'ip' | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  // Use a broad ref type to avoid TS complaining about the Camera value/type duality
  // cameraRef removed: using ImagePicker.launchCameraAsync for camera capture in this template

  // normalize mediaType helper to support various expo-image-picker exports
  const normalizeMediaType = (v: any): string => {
    if (typeof v === 'string') return v;
    if (!v) return 'Images';
    if (typeof v === 'object') {
      if ('Images' in v && typeof v.Images === 'string') return v.Images;
      if ('images' in v && typeof v.images === 'string') return v.images;
      for (const k of Object.keys(v)) {
        if (typeof v[k] === 'string') return v[k];
      }
    }
    return 'Images';
  };

  useEffect(() => {
    (async () => {
      // request camera permission via ImagePicker API (works on managed Expo)
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        setHasCameraPermission(status === 'granted');
      } catch (e) {
        setHasCameraPermission(false);
      }
    })();
  }, []);

  const takePhoto = async () => {
    // Use ImagePicker to launch the device camera (simpler cross-platform for testing)
    // Some versions export MediaType as string constants or objects; normalize to array of strings
    const normalize = (v: any): string => {
      if (typeof v === 'string') return v;
      if (!v) return 'Images';
      if (typeof v === 'object') {
        if ('Images' in v && typeof v.Images === 'string') return v.Images;
        if ('images' in v && typeof v.images === 'string') return v.images;
        // pick first string property
        for (const k of Object.keys(v)) {
          if (typeof v[k] === 'string') return v[k];
        }
      }
      return 'Images';
    };
    let raw: any = (ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaType ?? (ImagePicker as any).MediaTypeOptions ?? 'Images';
  // Do not pass mediaTypes to native on Android to avoid enum casting issues;
  // omit mediaTypes so native module uses its default behavior (usually images).
  const res = await ImagePicker.launchCameraAsync({});
    if (!(res as any).canceled) {
      setImageUri((res as any).assets?.[0]?.uri ?? (res as any).uri ?? null);
    }
  };

  const pickImage = async () => {
  let raw2: any = (ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaType ?? (ImagePicker as any).MediaTypeOptions ?? 'Images';
  // omit mediaTypes for native compatibility
  const res = await ImagePicker.launchImageLibraryAsync({});
    // modern expo-image-picker returns { canceled: boolean, assets: [...] }
    if (!(res as any).canceled) {
      setImageUri((res as any).assets?.[0]?.uri ?? (res as any).uri ?? null);
    }
  };

  const getLocation = async () => {
    // Helper to fetch an approximate location from an IP-geolocation service
    const fetchIpLocation = async () => {
      try {
        const resp = await fetch('https://ipapi.co/json/');
        if (!resp.ok) throw new Error('IP lookup failed');
        const j = await resp.json();
        // ipapi.co returns latitude/longitude
        const locObj = { coords: { latitude: j.latitude, longitude: j.longitude, accuracy: null }, ip: j };
        setLocation(locObj);
        setLocationSource('ip');
        // try to get a human readable address for display
        await reverseGeocode(j.latitude, j.longitude);
        return true;
      } catch (err) {
        return false;
      }
    };

    // Reverse geocode helper using Nominatim (OpenStreetMap) - lightweight, free for small use
    const reverseGeocode = async (lat: number, lon: number) => {
      try {
        setPrettyAddress(null);
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lon)}&accept-language=ko`;
        const r = await fetch(url, { headers: { 'User-Agent': 'expo-debug-template' } });
        if (!r.ok) throw new Error('Reverse geocode failed');
        const j = await r.json();
        setPrettyAddress(j.display_name || null);
      } catch (err) {
        // ignore reverse geocode failures - we still show coords
        setPrettyAddress(null);
      }
    };

    try {
      if (Platform.OS === 'web') {
        setLoadingLocation(true);
        // Try browser geolocation first
        if ((navigator as any)?.geolocation) {
          const success = async (pos: any) => {
            setLocation(pos);
            setLocationSource('gps');
            // reverse geocode
            await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            setLoadingLocation(false);
          };
          const failure = async (err: any) => {
            // If browser geolocation fails (or user denies), try IP fallback silently
            const ok = await fetchIpLocation();
            if (!ok) {
              setLocation({ error: { code: err?.code ?? null, message: err?.message ?? String(err) } });
            }
            setLoadingLocation(false);
          };
          // give geolocation a short timeout, then fallback
          (navigator as any).geolocation.getCurrentPosition(success, failure, { enableHighAccuracy: true, timeout: 8000 });
        } else {
          // No geolocation API - try IP-based lookup
          const ok = await fetchIpLocation();
          if (!ok) setLocation({ error: { code: 'no-geolocation', message: 'Geolocation not supported and IP fallback failed' } });
          setLoadingLocation(false);
        }
        return;
      }

      // Native path: request permissions and use Location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation({ error: { code: 'permission', message: 'Permission denied' } });
        return;
      }
  const loc = await Location.getCurrentPositionAsync({});
  setLocation(loc);
  setLocationSource('gps');
  await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } catch (e: any) {
      // If native Location fails, try IP fallback as last resort
      const ok = await fetchIpLocation();
      if (!ok) setLocation({ error: { code: e?.code ?? null, message: e?.message ?? String(e) } });
    }
  };

  const saveToFileSystem = async () => {
    if (!imageUri) return alert('No image to save');
    try {
      if (Platform.OS === 'web') {
        // In web, use browser download flow instead of expo-file-system
        const res = await fetch(imageUri);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'saved-photo.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        alert('Downloaded to browser');
      } else {
        const dest = `${(FileSystem as any).documentDirectory || ''}saved-photo.jpg`;
        // If imageUri is a remote URL (http/https) use downloadAsync, otherwise copy local file
        // choose a safe filename: prefer original basename, otherwise timestamp
        const extractBasename = (uri: string) => {
          try {
            const parts = uri.split('/');
            const last = parts.pop() || '';
            return last.split('?')[0] || `saved-${Date.now()}.jpg`;
          } catch (_) {
            return `saved-${Date.now()}.jpg`;
          }
        };
        const basename = extractBasename(imageUri);
        const finalDest = `${(FileSystem as any).documentDirectory || ''}${basename}`;
        if (/^https?:\/\//i.test(imageUri)) {
          const result = await (FileSystem as any).downloadAsync(imageUri, finalDest);
          alert('Saved to ' + (result?.uri ?? finalDest));
        } else {
          // local file (file:// or content:// on Android) - use copyAsync from legacy API
          try {
            await (FileSystem as any).copyAsync({ from: imageUri, to: finalDest });
            alert('Saved to ' + finalDest);
          } catch (e: any) {
            // If copyAsync fails (some content:// URIs), try downloadAsync as fallback
            try {
              const result = await (FileSystem as any).downloadAsync(imageUri, finalDest);
              alert('Saved to ' + (result?.uri ?? finalDest));
            } catch (err: any) {
              throw err;
            }
          }
        }
      }
    } catch (e: any) {
      // Show a friendly message and include error details for debugging
      alert('Save failed: ' + (e?.message ?? String(e)));
    }
  };

  // Reanimated + Gesture sample
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const onGestureEvent = (event: any) => {
    translateX.value = withSpring(event.nativeEvent.translationX || 0);
    translateY.value = withSpring(event.nativeEvent.translationY || 0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Native API & Animation Test</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Camera</Text>
        <Button title="Take Photo (Camera)" onPress={takePhoto} disabled={Platform.OS === 'web'} />
        <Text style={{ marginTop: 8 }}>(On web this opens the file picker instead)</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image Picker / File</Text>
        <Button title="Pick Image from Library" onPress={pickImage} />
        <Button title="Save picked image to FileSystem" onPress={saveToFileSystem} />
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Button title="Get Current Location" onPress={getLocation} />
        {location ? (
          location.error ? (
            <Text style={{ color: 'red', marginTop: 8 }}>
              {typeof location.error === 'string'
                ? location.error
                : `Error ${location.error.code ?? ''}: ${location.error.message ?? ''}`}
            </Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {prettyAddress ? (
                <Text style={{ fontWeight: '600' }}>{prettyAddress}</Text>
              ) : (
                <Text>Lat: {(location.coords?.latitude ?? '').toFixed(6)}, Lon: {(location.coords?.longitude ?? '').toFixed(6)}</Text>
              )}
              <Text style={{ color: '#666', marginTop: 4 }}>
                Source: {locationSource === 'gps' ? 'Device GPS' : locationSource === 'ip' ? 'IP fallback (대략적)' : 'Unknown'}
              </Text>
              {location.coords?.accuracy != null ? (
                <Text style={{ color: '#666' }}>Accuracy: {location.coords.accuracy}</Text>
              ) : locationSource === 'ip' ? (
                <Text style={{ color: '#a00' }}>정확도: 낮음 (IP 기반 위치)</Text>
              ) : null}
              <View style={{ marginTop: 8 }}>
                <Button title={loadingLocation ? 'Loading...' : 'Retry'} onPress={getLocation} disabled={loadingLocation} />
              </View>
            </View>
          )
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reanimated + Gesture</Text>
        <Text>Drag the box</Text>
        <PanGestureHandler onGestureEvent={onGestureEvent} onEnded={() => { translateX.value = withSpring(0); translateY.value = withSpring(0); }}>
          <Animated.View style={[styles.box, animatedStyle]} />
        </PanGestureHandler>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  cameraContainer: { height: 250, marginTop: 8 },
  camera: { flex: 1 },
  preview: { width: 200, height: 200, marginTop: 8 },
  box: { width: 80, height: 80, backgroundColor: 'tomato', marginTop: 12 },
});
