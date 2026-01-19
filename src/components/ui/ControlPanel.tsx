// ============================================================================
// MIRRORBODY-X : CONTROL PANEL COMPONENT
// UI for adjusting all settings
// ============================================================================

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSettings, PerformanceMode, LightingPreset } from '@/types';

interface ControlPanelProps {
  settings: AppSettings;
  onSettingsChange: (updates: Partial<AppSettings>) => void;
  onReset: () => void;
  performanceMetrics?: {
    fps: number;
    frameTime: number;
    inferenceTime: number;
  };
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onScreenshot?: () => void;
}

export function ControlPanel({
  settings,
  onSettingsChange,
  onReset,
  performanceMetrics,
  isRecording = false,
  onStartRecording,
  onStopRecording,
  onScreenshot,
}: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'clone' | 'shader' | 'effects' | 'performance'>('clone');

  return (
    <div className="fixed right-4 top-4 bottom-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-12 top-0 w-10 h-10 bg-black/80 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-black/90 transition-colors border border-white/10"
        aria-label={isOpen ? 'Close settings panel' : 'Open settings panel'}
        title={isOpen ? 'Close settings' : 'Open settings'}
      >
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="w-80 h-full bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">MirrorBody-X</h2>
              <p className="text-xs text-white/50">Control Panel</p>
            </div>

            {/* Performance Stats */}
            {performanceMetrics && (
              <div className="px-4 py-2 bg-white/5 flex justify-between text-xs">
                <span className="text-white/70">
                  FPS: <span className="text-cyan-400 font-mono">{performanceMetrics.fps}</span>
                </span>
                <span className="text-white/70">
                  Frame: <span className="text-cyan-400 font-mono">{performanceMetrics.frameTime.toFixed(1)}ms</span>
                </span>
                <span className="text-white/70">
                  Pose: <span className="text-cyan-400 font-mono">{performanceMetrics.inferenceTime.toFixed(1)}ms</span>
                </span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {(['clone', 'shader', 'effects', 'performance'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-cyan-400 bg-cyan-400/10 border-b-2 border-cyan-400'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'clone' && (
                <CloneSettings settings={settings} onChange={onSettingsChange} />
              )}
              {activeTab === 'shader' && (
                <ShaderSettings settings={settings} onChange={onSettingsChange} />
              )}
              {activeTab === 'effects' && (
                <EffectsSettings settings={settings} onChange={onSettingsChange} />
              )}
              {activeTab === 'performance' && (
                <PerformanceSettings settings={settings} onChange={onSettingsChange} />
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-white/10 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={onScreenshot}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                >
                  📸 Screenshot
                </button>
                <button
                  onClick={isRecording ? onStopRecording : onStartRecording}
                  className={`flex-1 py-2 rounded-lg text-white text-sm transition-colors ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {isRecording ? '⏹ Stop' : '🔴 Record'}
                </button>
              </div>
              <button
                onClick={onReset}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-sm transition-colors"
              >
                Reset to Defaults
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SETTINGS SECTIONS
// ============================================================================

interface SettingsProps {
  settings: AppSettings;
  onChange: (updates: Partial<AppSettings>) => void;
}

function CloneSettings({ settings, onChange }: SettingsProps) {
  return (
    <div className="space-y-4">
      <Toggle
        label="Clone Enabled"
        value={settings.cloneEnabled}
        onChange={(cloneEnabled) => onChange({ cloneEnabled })}
      />

      <Slider
        label="X Offset"
        value={settings.cloneOffset.x}
        min={-3}
        max={3}
        step={0.1}
        onChange={(x) =>
          onChange({
            cloneOffset: settings.cloneOffset.clone().setX(x),
          })
        }
      />

      <Slider
        label="Y Offset"
        value={settings.cloneOffset.y}
        min={-1}
        max={1}
        step={0.1}
        onChange={(y) =>
          onChange({
            cloneOffset: settings.cloneOffset.clone().setY(y),
          })
        }
      />

      <Slider
        label="Rotation"
        value={(settings.cloneRotation * 180) / Math.PI}
        min={-45}
        max={45}
        step={1}
        unit="°"
        onChange={(deg) => onChange({ cloneRotation: (deg * Math.PI) / 180 })}
      />
    </div>
  );
}

function ShaderSettings({ settings, onChange }: SettingsProps) {
  return (
    <div className="space-y-4">
      <Slider
        label="Intensity"
        value={settings.shaderIntensity}
        min={0}
        max={3}
        step={0.1}
        onChange={(shaderIntensity) => onChange({ shaderIntensity })}
      />

      <Slider
        label="Roughness"
        value={settings.mirrorRoughness}
        min={0}
        max={1}
        step={0.01}
        onChange={(mirrorRoughness) => onChange({ mirrorRoughness })}
      />

      <Slider
        label="Metalness"
        value={settings.mirrorMetalness}
        min={0}
        max={1}
        step={0.01}
        onChange={(mirrorMetalness) => onChange({ mirrorMetalness })}
      />

      <Slider
        label="Fresnel Power"
        value={settings.fresnelPower}
        min={1}
        max={5}
        step={0.1}
        onChange={(fresnelPower) => onChange({ fresnelPower })}
      />

      <ColorPicker
        label="Tint Color"
        value={settings.tintColor}
        onChange={(tintColor) => onChange({ tintColor })}
      />

      <Select
        label="Lighting Preset"
        value={settings.lightingPreset}
        options={[
          { value: 'studio', label: 'Studio' },
          { value: 'sunset', label: 'Sunset' },
          { value: 'neon', label: 'Neon' },
          { value: 'dramatic', label: 'Dramatic' },
          { value: 'soft', label: 'Soft' },
        ]}
        onChange={(lightingPreset) => onChange({ lightingPreset: lightingPreset as LightingPreset })}
      />

      <Slider
        label="Environment Intensity"
        value={settings.environmentIntensity}
        min={0}
        max={2}
        step={0.1}
        onChange={(environmentIntensity) => onChange({ environmentIntensity })}
      />
    </div>
  );
}

function EffectsSettings({ settings, onChange }: SettingsProps) {
  const updateEffects = (path: string, value: unknown) => {
    const parts = path.split('.');
    const newEffects = { ...settings.effects };
    
    let current: Record<string, unknown> = newEffects;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = { ...(current[parts[i]] as Record<string, unknown>) };
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
    
    onChange({ effects: newEffects as typeof settings.effects });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">Glow</div>
      <Toggle
        label="Enable Glow"
        value={settings.effects.glow.enabled}
        onChange={(v) => updateEffects('glow.enabled', v)}
      />
      <Slider
        label="Glow Intensity"
        value={settings.effects.glow.intensity}
        min={0}
        max={2}
        step={0.1}
        onChange={(v) => updateEffects('glow.intensity', v)}
      />

      <div className="text-xs text-white/50 uppercase tracking-wider pt-2">Motion Trails</div>
      <Toggle
        label="Enable Trails"
        value={settings.effects.motionTrail.enabled}
        onChange={(v) => updateEffects('motionTrail.enabled', v)}
      />
      <Slider
        label="Trail Length"
        value={settings.effects.motionTrail.length}
        min={1}
        max={20}
        step={1}
        onChange={(v) => updateEffects('motionTrail.length', v)}
      />

      <div className="text-xs text-white/50 uppercase tracking-wider pt-2">Floor</div>
      <Toggle
        label="Reflective Floor"
        value={settings.effects.floorReflection.enabled}
        onChange={(v) => updateEffects('floorReflection.enabled', v)}
      />
      <Slider
        label="Floor Opacity"
        value={settings.effects.floorReflection.opacity}
        min={0}
        max={1}
        step={0.1}
        onChange={(v) => updateEffects('floorReflection.opacity', v)}
      />

      <Toggle
        label="Shadows"
        value={settings.effects.shadowEnabled}
        onChange={(shadowEnabled) => onChange({ effects: { ...settings.effects, shadowEnabled } })}
      />
    </div>
  );
}

function PerformanceSettings({ settings, onChange }: SettingsProps) {
  return (
    <div className="space-y-4">
      <Select
        label="Performance Mode"
        value={settings.performanceMode}
        options={[
          { value: 'quality', label: 'Quality (30 FPS)' },
          { value: 'balanced', label: 'Balanced (30 FPS)' },
          { value: 'performance', label: 'Performance (60 FPS)' },
        ]}
        onChange={(performanceMode) => onChange({ performanceMode: performanceMode as PerformanceMode })}
      />

      <Slider
        label="Target FPS"
        value={settings.targetFPS}
        min={15}
        max={60}
        step={5}
        onChange={(targetFPS) => onChange({ targetFPS })}
      />

      <Toggle
        label="Adaptive Resolution"
        value={settings.adaptiveResolution}
        onChange={(adaptiveResolution) => onChange({ adaptiveResolution })}
      />

      <div className="text-xs text-white/50 uppercase tracking-wider pt-2">Camera</div>
      <Select
        label="Resolution"
        value={`${settings.camera.width}x${settings.camera.height}`}
        options={[
          { value: '640x480', label: '640×480 (SD)' },
          { value: '1280x720', label: '1280×720 (HD)' },
          { value: '1920x1080', label: '1920×1080 (FHD)' },
        ]}
        onChange={(v) => {
          const [width, height] = v.split('x').map(Number);
          onChange({
            camera: { ...settings.camera, width, height },
          });
        }}
      />
    </div>
  );
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, value, onChange }: ToggleProps) {
  const id = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm text-white/80">{label}</label>
      <button
        id={id}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`w-12 h-6 rounded-full transition-colors ${
          value ? 'bg-cyan-500' : 'bg-white/20'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
            value ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit = '', onChange }: SliderProps) {
  const id = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="text-white/80">{label}</label>
        <span className="text-cyan-400 font-mono">
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
          [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-400 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  const id = `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm text-white/80">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full p-2 bg-white/10 rounded-lg text-white text-sm border border-white/10 focus:outline-none focus:border-cyan-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-gray-900">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const id = `color-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm text-white/80">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-8 h-8 rounded-lg cursor-pointer border border-white/20"
        />
        <span className="text-xs text-white/50 font-mono">{value}</span>
      </div>
    </div>
  );
}

export default ControlPanel;
