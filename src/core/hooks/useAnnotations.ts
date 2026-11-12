import { useEffect, useState } from 'react';
import {
  EMPTY_ANNOTATIONS,
  getCachedAnnotations,
  loadAnnotations,
  type AnnotationMap,
} from '../annotations';

/**
 * Annotations for the activity list.
 *
 * Unlike `getActivityData()` this does NOT suspend: it starts with an empty map
 * and fills in once the file has loaded. Tracks therefore render on the very
 * first paint exactly as they did before this feature existed, and a missing or
 * malformed annotations file simply means "no tags".
 */
export function useAnnotations(): AnnotationMap {
  const [annotations, setAnnotations] = useState<AnnotationMap>(
    () => getCachedAnnotations() ?? EMPTY_ANNOTATIONS
  );

  useEffect(() => {
    let active = true;
    void loadAnnotations().then((loaded) => {
      if (active) setAnnotations(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return annotations;
}
