import { expect, it } from 'vitest';
import { canDisplaySite } from '../src/site-access';
const official = { origin: 'https://frank-aestheticmedicine.github.io', pathname: '/', search: '' };
it('only the exact official root can display the production site', () => {
  expect(canDisplaySite(official, true)).toBe(true);
  for (const origin of ['https://qwe953751.github.io', 'http://frank-aestheticmedicine.github.io', 'https://example.com']) expect(canDisplaySite({...official,origin},true)).toBe(false);
  for (const pathname of ['/AestheticMedicine/', '/index.html', '/viewer/']) expect(canDisplaySite({...official,pathname},true)).toBe(false);
  expect(canDisplaySite({...official, search:'?access=viewer'},true)).toBe(false);
});
it('the official site remains blank when embedded by another page', () => {
  expect(canDisplaySite(official,false)).toBe(false);
});
