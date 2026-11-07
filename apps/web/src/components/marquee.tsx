/**
 * How many times one half of the track repeats the list. Two halves are laid
 * end to end and the track is translated by -50%, so the seam is invisible;
 * each half repeats the list often enough that it is still wider than the
 * screen on a wide display, where a single pass would leave a blank gap.
 */
const REPEATS = 3;
const passes = Array.from({ length: REPEATS }, (_, index) => index);

function Run({ hidden, items }: { hidden?: boolean; items: string[] }) {
  return (
    <div aria-hidden={hidden || undefined} className="marquee-run">
      {items.map((item) => (
        <span className="marquee-item" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

/**
 * A thin, full-bleed ticker. The content is decorative: only the first pass
 * reaches the accessibility tree, and every repeat is `aria-hidden`. Under
 * `prefers-reduced-motion: reduce` the extra passes are not displayed and the
 * one remaining pass wraps (see `.marquee` in `app.css`), so the band is
 * static and never scrolls sideways.
 */
export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="marquee">
      <div className="marquee-track">
        <div className="marquee-half">
          {passes.map((pass) => (
            <Run hidden={pass > 0} items={items} key={pass} />
          ))}
        </div>
        <div aria-hidden="true" className="marquee-half">
          {passes.map((pass) => (
            <Run items={items} key={pass} />
          ))}
        </div>
      </div>
    </div>
  );
}
