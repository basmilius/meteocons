# meteocons

Animated weather icons for the modern web. 475+ hand-crafted icons in 4 styles, available as SVG and Lottie.

This is a convenience package that includes both [@meteocons/svg](https://www.npmjs.com/package/@meteocons/svg) and [@meteocons/lottie](https://www.npmjs.com/package/@meteocons/lottie).

## Installation

```bash
bun add meteocons
npm install meteocons
yarn add meteocons
pnpm add meteocons
```

## Usage

### SVG

```html
<img src="meteocons/svg/fill/clear-day.svg" alt="Clear day" width="64" height="64" />
```

### Lottie

```js
import lottie from 'lottie-web';
import clearDay from 'meteocons/lottie/fill/clear-day.json';

lottie.loadAnimation({
  container: document.getElementById('icon'),
  animationData: clearDay,
  loop: true,
  autoplay: true,
});
```

### Manifest

```js
import { svgManifest, lottieManifest } from 'meteocons';
```

## Styles

Icons are available in 4 styles: `fill`, `flat`, `line`, and `monochrome`.

## Individual packages

If you only need one format, install the individual package to keep your bundle smaller:

- **SVG only**: `bun add @meteocons/svg`
- **Lottie only**: `bun add @meteocons/lottie`

## License

[MIT](LICENSE) - Bas Milius
