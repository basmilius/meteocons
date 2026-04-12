# @meteocons/svg-static

Static SVG weather icons without SMIL animations. 475+ hand-crafted icons in 4 styles.

Use this package when you need weather icons without animation — for example in emails, static documents, or environments where SMIL `<animate>` elements are not supported.

For animated SVGs, use [`@meteocons/svg`](https://www.npmjs.com/package/@meteocons/svg) instead.

## Installation

```bash
bun add @meteocons/svg-static
npm install @meteocons/svg-static
yarn add @meteocons/svg-static
pnpm add @meteocons/svg-static
```

## Usage

```html
<img src="@meteocons/svg-static/fill/clear-day.svg" alt="Clear day" width="64" height="64" />
```

### Inline SVG

```js
import clearDay from '@meteocons/svg-static/fill/clear-day.svg?raw';
document.getElementById('icon').innerHTML = clearDay;
```

## Styles

Icons are available in 4 styles: `fill`, `flat`, `line`, and `monochrome`.

```
@meteocons/svg-static/fill/clear-day.svg
@meteocons/svg-static/flat/clear-day.svg
@meteocons/svg-static/line/clear-day.svg
@meteocons/svg-static/monochrome/clear-day.svg
```

## Manifest

A `manifest.json` is included with metadata for all icons:

```js
import manifest from '@meteocons/svg-static/manifest.json';
```

## License

[MIT](LICENSE) - Bas Milius
