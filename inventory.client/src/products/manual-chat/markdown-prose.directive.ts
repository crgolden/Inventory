import { Directive } from '@angular/core';

@Directive({
  selector: '[appMarkdownProse]',
  host: { class: '[&_:first-child]:mt-0 [&_:last-child]:mb-0 [&_:is(h1,h2,h3,h4,h5,h6)]:mt-3 [&_:is(h1,h2,h3,h4,h5,h6)]:mb-1 [&_:is(h1,h2,h3,h4,h5,h6)]:text-body [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(ul,ol)]:mb-2 [&_:is(ul,ol)]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:mb-[0.2rem] [&_p]:mb-2 [&_a]:text-accent [&_a]:underline [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:font-mono [&_code]:text-[0.875em] [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-surface-2 [&_pre]:px-4 [&_pre]:py-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[0.8rem] [&_hr]:my-3 [&_hr]:border-t [&_hr]:border-line [&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-text-muted' },
})
export class MarkdownProseDirective {}
