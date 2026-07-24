import { readFlixPromoEnabled, parseFlixPromoEnabled } from './flix-promo.enabled';

describe('flix-promo.enabled', () => {
  describe('parseFlixPromoEnabled', () => {
    it('defaults to true when unset', () => {
      expect(parseFlixPromoEnabled(undefined)).toBeTrue();
      expect(parseFlixPromoEnabled('')).toBeTrue();
    });

    it('treats falsey values as off', () => {
      expect(parseFlixPromoEnabled('false')).toBeFalse();
      expect(parseFlixPromoEnabled('FALSE')).toBeFalse();
      expect(parseFlixPromoEnabled('0')).toBeFalse();
      expect(parseFlixPromoEnabled('off')).toBeFalse();
    });

    it('treats other values as on', () => {
      expect(parseFlixPromoEnabled('true')).toBeTrue();
      expect(parseFlixPromoEnabled('1')).toBeTrue();
    });
  });

  describe('readFlixPromoEnabled', () => {
    it('defaults to true without meta', () => {
      const doc = document.implementation.createHTMLDocument();
      expect(readFlixPromoEnabled(doc)).toBeTrue();
    });

    it('reads meta content', () => {
      const doc = document.implementation.createHTMLDocument();
      const meta = doc.createElement('meta');
      meta.setAttribute('name', 'cp-flix-promo');
      meta.setAttribute('content', '0');
      doc.head.appendChild(meta);
      expect(readFlixPromoEnabled(doc)).toBeFalse();
    });
  });
});
