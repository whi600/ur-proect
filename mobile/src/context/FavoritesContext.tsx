import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = '@pravo-orbita/favorite-document-ids/v1';

interface FavoritesState {
  ids: string[];
  isReady: boolean;
  error?: string;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesState | undefined>(undefined);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [ids, setIds] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((rawValue) => {
        if (!active) {
          return;
        }
        const parsed = rawValue ? JSON.parse(rawValue) : [];
        setIds(
          Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [],
        );
      })
      .catch(() => {
        if (active) {
          setError('Не удалось прочитать локальное избранное.');
        }
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const nextIds = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
      setIds(nextIds);
      setError(undefined);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextIds));
      } catch {
        setIds(ids);
        setError('Не удалось сохранить избранное на устройстве.');
      }
    },
    [ids],
  );

  const value = useMemo<FavoritesState>(
    () => ({
      ids,
      isReady,
      error,
      isFavorite: (id) => ids.includes(id),
      toggleFavorite,
    }),
    [error, ids, isReady, toggleFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesState {
  const value = useContext(FavoritesContext);
  if (!value) {
    throw new Error('useFavorites must be used inside FavoritesProvider.');
  }
  return value;
}
