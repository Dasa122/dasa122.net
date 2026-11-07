export function Prose({ html }: { html: string }) {
  return (
    <div
      className="prose max-w-[68ch] text-[1.0625rem] leading-[1.75] text-ink [&_blockquote]:my-6 [&_blockquote]:border-rule [&_blockquote]:border-l [&_blockquote]:pl-5 [&_blockquote]:text-muted [&_code]:font-mono [&_code]:text-[0.875em] [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-3xl [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-display [&_h3]:text-2xl [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-5 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-rule [&_pre]:bg-rule/20 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.875rem] [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6"
      // `html` is sanitised at the API boundary; sanitising again here would
      // create a second, divergent implementation.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
