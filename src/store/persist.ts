import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

/**
 * zustand persist 的存储适配层。
 *
 * 三个 store 各自独立持久化（方案 §4.2）：持久化粒度更细、订阅更精准、迁移更稳。
 * 键名统一带 `es-conj:` 前缀，避免与将来别的功能撞车。
 */
export const STORAGE_KEYS = {
  settings: 'es-conj:settings',
  custom: 'es-conj:custom',
  stats: 'es-conj:stats',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** 每个 store 都用 `storage: createStoreStorage()` 拿到同一套适配器 */
export const createStoreStorage = (): PersistStorage<unknown> | undefined =>
  createJSONStorage(() => AsyncStorage);

/** 供"清空全部数据"用；注意不要动 verbs.json（它只读、且不在这里） */
export async function clearAllStores(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}
