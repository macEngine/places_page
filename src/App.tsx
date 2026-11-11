import { sanitizePlaces, type Place } from '@/core/places';
import { useRoute } from '@/core/router';
import { useTheme } from '@/core/theme';
import rawPlaces from '@/data/places.json';
import Header from '@/components/Header';
import HomePage from '@/pages/HomePage';
import WallPage from '@/pages/WallPage';

const ALL_PLACES: Place[] = sanitizePlaces(rawPlaces);

export default function App() {
  const { theme, toggle } = useTheme();
  const route = useRoute();
  return (
    <>
      <Header theme={theme} onToggleTheme={toggle} active={route.page} />
      {route.page === 'wall' ? (
        <WallPage all={ALL_PLACES} focusKey={route.focus} />
      ) : (
        <HomePage all={ALL_PLACES} />
      )}
    </>
  );
}
