import rainbowImage from '../assets/rainbow.png';

export interface SpecialThanksItem {
  name: string;
  note?: string;
  image: string;
  href: string;
  analyticsEvent: string;
}

export const SPECIAL_THANKS: SpecialThanksItem[] = [
  {
    name: 'csgofriberg',
    note: '本站所基于的原项目',
    image: rainbowImage,
    href: 'https://github.com/shnlfriberg/csgofriberg',
    analyticsEvent: 'home-special-thanks-csgofriberg',
  },
];

if (SPECIAL_THANKS.length > 10) {
  throw new Error('SPECIAL_THANKS_LIMIT_EXCEEDED');
}
