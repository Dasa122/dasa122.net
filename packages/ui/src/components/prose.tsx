const prose =
  "max-w-[68ch] text-[1.0625rem] leading-[1.75] text-ink " +
  "[&_a]:text-ember-text [&_a]:underline [&_a]:decoration-ember [&_a]:underline-offset-4 [&_a:hover]:decoration-ember-text " +
  "[&_blockquote]:my-7 [&_blockquote]:border-l-2 [&_blockquote]:border-ember [&_blockquote]:[border-image:linear-gradient(to_bottom,var(--grad-1),var(--grad-2))_1] [&_blockquote]:pl-5 [&_blockquote]:font-sans [&_blockquote]:italic [&_blockquote]:text-muted " +
  "[&_code]:rounded-[var(--radius-sm)] [&_code]:bg-[var(--color-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] " +
  "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:leading-[1.05] [&_h2]:tracking-[-0.045em] " +
  "[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:leading-[1.1] [&_h3]:tracking-[-0.035em] " +
  "[&_hr]:my-10 [&_hr]:border-[var(--hairline)] " +
  "[&_img]:rounded-[var(--radius-lg)] [&_img]:border [&_img]:border-[var(--hairline)] " +
  "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_p]:my-6 " +
  "[&_pre]:my-7 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-lg)] [&_pre]:border [&_pre]:border-[var(--glass-edge)] [&_pre]:bg-[var(--color-surface-2)] [&_pre]:p-5 [&_pre]:shadow-[inset_0_1px_0_var(--glass-hi)] [&_pre]:text-[0.8125rem] " +
  "[&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[inherit] " +
  "[&_table]:w-full [&_table]:text-[0.9375rem] [&_th]:border-b [&_th]:border-[var(--hairline)] [&_th]:pb-2 [&_th]:text-left [&_td]:border-b [&_td]:border-[var(--hairline)] [&_td]:py-2 " +
  "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6";

export function Prose({ html }: { html: string }) {
  return (
    <div
      className={prose}
      // `html` is sanitised at the API boundary; sanitising again here would
      // create a second, divergent implementation.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
