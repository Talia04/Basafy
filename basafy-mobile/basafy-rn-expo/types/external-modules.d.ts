declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getAllKeys(): Promise<string[]>;
    multiRemove(keys: readonly string[]): Promise<void>;
    clear?(): Promise<void>;
  };

  export default AsyncStorage;
}

declare module 'expo-updates' {
  export function reloadAsync(): Promise<void>;
}
