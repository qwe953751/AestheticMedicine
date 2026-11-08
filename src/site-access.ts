export function canDisplaySite(location: { origin: string; pathname: string; search: string }, topLevel: boolean): boolean {
  return topLevel && location.origin === 'https://frank-aestheticmedicine.github.io' && location.pathname === '/' && location.search === '';
}
