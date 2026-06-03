/**
 * KLOOM Roleplay - Master Export
 * Phase 7: Rooms 41-60 (Persona IDs 165-244)
 */

export * from './kloom_rooms_final';
export * from './rooms_41_50';
export * from './rooms_51_60';

// Combined export of all rooms
export const ALL_ROOMS = [...ROOMS_41_50, ...ROOMS_51_60];

// Export individual room arrays for convenience
export { ROOMS_41_50 } from './rooms_41_50';
export { ROOMS_51_60 } from './rooms_51_60';
