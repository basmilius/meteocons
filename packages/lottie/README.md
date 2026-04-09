# @meteocons/lottie

Animated Lottie weather icons. 475+ hand-crafted animations in 4 styles.

## Installation

```bash
bun add @meteocons/lottie
npm install @meteocons/lottie
yarn add @meteocons/lottie
pnpm add @meteocons/lottie
```

## Usage

```js
import lottie from 'lottie-web';
import clearDay from '@meteocons/lottie/fill/clear-day.json';

lottie.loadAnimation({
  container: document.getElementById('icon'),
  animationData: clearDay,
  loop: true,
  autoplay: true,
});
```

## Styles

Animations are available in 4 styles: `fill`, `flat`, `line`, and `monochrome`.

```
@meteocons/lottie/fill/clear-day.json
@meteocons/lottie/flat/clear-day.json
@meteocons/lottie/line/clear-day.json
@meteocons/lottie/monochrome/clear-day.json
```

## Manifest

A `manifest.json` is included with metadata for all icons:

```js
import manifest from '@meteocons/lottie/manifest.json';
```

## License

[MIT](LICENSE) - Bas Milius
