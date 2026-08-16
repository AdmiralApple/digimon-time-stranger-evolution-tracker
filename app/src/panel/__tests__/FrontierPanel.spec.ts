import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FrontierPanel } from '../FrontierPanel';

describe('FrontierPanel', () => {
  it('offers reveal without leaking the hidden form identity', () => {
    const html = renderToStaticMarkup(createElement(FrontierPanel, { slug: 'greymon' }));

    expect(html).toContain('Click to reveal');
    expect(html).toContain('Unknown Digimon');
    expect(html).not.toContain('Greymon');
    expect(html).not.toContain('greymon');
  });
});
