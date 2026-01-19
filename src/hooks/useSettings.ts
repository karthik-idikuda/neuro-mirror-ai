// ============================================================================
// MIRRORBODY-X : SETTINGS HOOK
// React hook for managing application settings
// ============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { AppSettings, DEFAULT_SETTINGS, PerformanceMode, LightingPreset } from '@/types';

const STORAGE_KEY = 'mirrorbody-settings';

interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  setCloneEnabled: (enabled: boolean) => void;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setLightingPreset: (preset: LightingPreset) => void;
  setShaderIntensity: (intensity: number) => void;
  setMirrorRoughness: (roughness: number) => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Reconstruct THREE.js objects
          const reconstructed = reconstructSettings(parsed);
          setSettings(reconstructed);
        } catch (e) {
          console.warn('[useSettings] Failed to load stored settings');
        }
      }
    }
  }, []);

  // Save settings to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const serializable = serializeSettings(settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    }
  }, [settings]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Convenience setters
  const setCloneEnabled = useCallback((enabled: boolean) => {
    updateSettings({ cloneEnabled: enabled });
  }, [updateSettings]);

  const setPerformanceMode = useCallback((mode: PerformanceMode) => {
    const presets: Record<PerformanceMode, Partial<AppSettings>> = {
      quality: {
        performanceMode: 'quality',
        targetFPS: 30,
        adaptiveResolution: false,
      },
      balanced: {
        performanceMode: 'balanced',
        targetFPS: 30,
        adaptiveResolution: true,
      },
      performance: {
        performanceMode: 'performance',
        targetFPS: 60,
        adaptiveResolution: true,
      },
    };
    updateSettings(presets[mode]);
  }, [updateSettings]);

  const setLightingPreset = useCallback((preset: LightingPreset) => {
    updateSettings({ lightingPreset: preset });
  }, [updateSettings]);

  const setShaderIntensity = useCallback((intensity: number) => {
    updateSettings({ shaderIntensity: Math.max(0, Math.min(2, intensity)) });
  }, [updateSettings]);

  const setMirrorRoughness = useCallback((roughness: number) => {
    updateSettings({ mirrorRoughness: Math.max(0, Math.min(1, roughness)) });
  }, [updateSettings]);

  // Export settings as JSON
  const exportSettings = useCallback((): string => {
    return JSON.stringify(serializeSettings(settings), null, 2);
  }, [settings]);

  // Import settings from JSON
  const importSettings = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      const reconstructed = reconstructSettings(parsed);
      setSettings(reconstructed);
      return true;
    } catch (e) {
      console.error('[useSettings] Failed to import settings:', e);
      return false;
    }
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    setCloneEnabled,
    setPerformanceMode,
    setLightingPreset,
    setShaderIntensity,
    setMirrorRoughness,
    exportSettings,
    importSettings,
  };
}

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

function serializeSettings(settings: AppSettings): Record<string, unknown> {
  return {
    ...settings,
    cloneOffset: {
      x: settings.cloneOffset.x,
      y: settings.cloneOffset.y,
      z: settings.cloneOffset.z,
    },
    effects: {
      ...settings.effects,
      glow: {
        ...settings.effects.glow,
        color: '#' + settings.effects.glow.color.getHexString(),
      },
      motionTrail: {
        ...settings.effects.motionTrail,
        color: '#' + settings.effects.motionTrail.color.getHexString(),
      },
      lightRays: {
        ...settings.effects.lightRays,
        color: '#' + settings.effects.lightRays.color.getHexString(),
      },
      floorReflection: {
        ...settings.effects.floorReflection,
        color: '#' + settings.effects.floorReflection.color.getHexString(),
      },
    },
  };
}

function reconstructSettings(data: Record<string, unknown>): AppSettings {
  const defaults = DEFAULT_SETTINGS;
  
  return {
    ...defaults,
    ...data,
    cloneOffset: data.cloneOffset 
      ? new THREE.Vector3(
          (data.cloneOffset as { x: number }).x,
          (data.cloneOffset as { y: number }).y,
          (data.cloneOffset as { z: number }).z
        )
      : defaults.cloneOffset,
    effects: data.effects ? {
      glow: {
        ...(data.effects as { glow: Record<string, unknown> }).glow,
        color: new THREE.Color(
          ((data.effects as { glow: { color: string } }).glow.color) || '#00ffff'
        ),
      } as typeof defaults.effects.glow,
      motionTrail: {
        ...(data.effects as { motionTrail: Record<string, unknown> }).motionTrail,
        color: new THREE.Color(
          ((data.effects as { motionTrail: { color: string } }).motionTrail.color) || '#4488ff'
        ),
      } as typeof defaults.effects.motionTrail,
      lightRays: {
        ...(data.effects as { lightRays: Record<string, unknown> }).lightRays,
        color: new THREE.Color(
          ((data.effects as { lightRays: { color: string } }).lightRays.color) || '#ffffff'
        ),
      } as typeof defaults.effects.lightRays,
      floorReflection: {
        ...(data.effects as { floorReflection: Record<string, unknown> }).floorReflection,
        color: new THREE.Color(
          ((data.effects as { floorReflection: { color: string } }).floorReflection.color) || '#111122'
        ),
      } as typeof defaults.effects.floorReflection,
      shadowEnabled: (data.effects as { shadowEnabled?: boolean }).shadowEnabled ?? true,
    } : defaults.effects,
  } as AppSettings;
}
