import { useEffect, useRef } from 'react';

type BackDismissEntry = {
  id: number;
  onBack: () => void;
};

let nextBackDismissId = 1;
const backDismissStack: BackDismissEntry[] = [];

export const dismissTopBackLayer = () => {
  const entry = backDismissStack[backDismissStack.length - 1];
  if (!entry) return false;

  entry.onBack();
  return true;
};

export const useBackDismiss = (active: boolean, onBack: () => void) => {
  const idRef = useRef<number | null>(null);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active) {
      if (idRef.current !== null) {
        const index = backDismissStack.findIndex((entry) => entry.id === idRef.current);
        if (index !== -1) backDismissStack.splice(index, 1);
        idRef.current = null;
      }
      return;
    }

    const id = idRef.current ?? nextBackDismissId++;
    idRef.current = id;

    if (!backDismissStack.some((entry) => entry.id === id)) {
      backDismissStack.push({
        id,
        onBack: () => onBackRef.current(),
      });
    }

    return () => {
      const index = backDismissStack.findIndex((entry) => entry.id === id);
      if (index !== -1) backDismissStack.splice(index, 1);
      if (idRef.current === id) idRef.current = null;
    };
  }, [active]);
};
