/**
 * KLOOM Roleplay - Type Definitions
 * Master type definitions for all KLOOM roleplay rooms
 * Phase 7: Rooms 41-60 (Persona IDs 165-244)
 */

// ============================================
// CORE TYPES
// ============================================

export interface Room {
  id: string;
  name: string;
  tagline: string;
  description: string;
  shortDescription: string;
  topic: string;
  story: {
    title: string;
    description: string;
    scenario: string;
    userEntrance: string;
  };
  metadata: {
    intensity: number;
    vibes: string[];
    expectations: string[];
    userRole: string;
    tags: string[];
    language: string;
    vibeLevel: string;
  };
  personas: Persona[];
  relationship: string;
  capabilities: {
    voice: boolean;
    chat: boolean;
    tools: Tool[];
    options: Option[];
    skills: string[];
    primaryTool: string;
    requiredTools: string[];
  };
  preview: {
    audioSnippet: string;
    liveIndicator: boolean;
    activeSpeakers: string[];
    vibe: string;
    previewStyle: string;
    previewDuration: number;
  };
  invitationSettings: {
    allowHumanInvites: boolean;
    defaultGender: string;
    defaultTags: string[];
    billing: string;
    inviteLinkPrefix: string;
    maxInvites: number;
  };
  micPassing: {
    enabled: boolean;
    buttonLabel: string;
    soundEffect: boolean;
    autoPass: boolean;
    passTimeout: number;
  };
  personaVisibility: {
    allVisible: boolean;
    activeOnly: boolean;
    roleBased: boolean;
    showMicStatus: boolean;
  };
  memory: {
    enabled: boolean;
    retention: string;
    autoSave: boolean;
    exportable: boolean;
    searchable: boolean;
    maxHistory: number;
  };
  accountFeatures: {
    unrestrictedMode: boolean;
    modelSelection: string;
    practicingLevel: {
      editable: boolean;
      affectsMic: boolean;
      levels: string[];
    };
    premiumAccess: boolean;
    adultContentAllowed: boolean;
  };
  ui: {
    layout: string;
    cardSize: string;
    categoryDisplay: string;
    showLivePreview: boolean;
    animatedCards: boolean;
    theme: string;
    gradient: string;
    accentColor: string;
    icon: string;
  };
  restrictions: {
    blockedTopics: string[];
    modelChangeAllowed: boolean;
    adult: boolean;
    accountLevel: string;
    minAge: number;
  };
  category: string;
  tags: string[];
  gradient: string;
  accentColor: string;
  icon: string;
  popular: boolean;
  featured: boolean;
  new: boolean;
  premium: boolean;
  teachingRatio: number;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  model: string;
  modelLocked: boolean;
  age: number;
  appearance: string;
  backstory: string;
  personality: string;
  speakingStyle: string;
  voice: string;
  gender: string;
  micActive: boolean;
  practicingLevel: string;
  relationshipToOthers: string;
}

export interface Tool {
  id: string;
  label: string;
  icon: string;
  type: string;
  customData?: Record<string, boolean | number | string>;
}

export interface Option {
  id: string;
  label: string;
  type: string;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue: string | number;
}

// ============================================
// BLOCKED TOPICS
// ============================================

export const BLOCKED_TOPICS = [
  "real person", "real people", "celebrity", "celebrities",
  "politics", "religion", "religious", "nsfw", "explicit",
  "adult content", "hate speech", "violence", "self-harm",
  "suicide", "illegal activities", "personal information",
  "privacy violation", "harassment", "bullying",
  "discrimination", "racism", "sexism", "xenophobia",
  "homophobia", "transphobia", "ableism", "ageism",
  "body shaming", "mental health stigma"
];

// ============================================
// UTILITY TYPES
// ============================================

export type ModelType = 'mistral' | 'claude' | 'gemini' | 'openai' | string;
export type VoiceType = 'echo' | 'shimmer' | 'verse' | 'alloy' | 'nova' | string;
export type GenderType = 'male' | 'female' | 'non-binary' | 'other' | string;
export type PracticingLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | string;
export type ThemeType = 'fae' | 'dark' | 'wild' | 'cosmic' | 'ancient' | 'modern' | string;
