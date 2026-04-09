# @meteocons/svg

Animated SVG weather icons. 475+ hand-crafted icons in 4 styles.

## Installation

```bash
bun add @meteocons/svg
npm install @meteocons/svg
yarn add @meteocons/svg
pnpm add @meteocons/svg
```

## Usage

```html
<img src="@meteocons/svg/fill/clear-day.svg" alt="Clear day" width="64" height="64" />
```

### Inline SVG

```js
import clearDay from '@meteocons/svg/fill/clear-day.svg?raw';
document.getElementById('icon').innerHTML = clearDay;
```

## Styles

Icons are available in 4 styles: `fill`, `flat`, `line`, and `monochrome`.

```
@meteocons/svg/fill/clear-day.svg
@meteocons/svg/flat/clear-day.svg
@meteocons/svg/line/clear-day.svg
@meteocons/svg/monochrome/clear-day.svg
```

## Manifest

A `manifest.json` is included with metadata for all icons:

```js
import manifest from '@meteocons/svg/manifest.json';
```

## License

[MIT](LICENSE) - Bas Milius
