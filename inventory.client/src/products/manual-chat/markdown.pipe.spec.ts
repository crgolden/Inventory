import { TestBed } from '@angular/core/testing';
import { newText } from '@crgolden/modules/testing';
import { MarkdownPipe } from './markdown.pipe';

function rendered(html: string | null): HTMLElement {
  if (html === null) {
    throw new Error('The pipe returned null, so there is no markup to inspect.');
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

function textsOf(container: HTMLElement, selector: string): (string | null)[] {
  return Array.from(container.querySelectorAll(selector)).map(element => element.textContent);
}

function listItemTexts(list: Element | null): (string | null)[] {
  return Array.from(list?.children ?? []).map(item => (item instanceof HTMLLIElement ? item.textContent : null));
}

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new MarkdownPipe());
  });

  it('returns null for null', () => {
    expect(pipe.transform(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(pipe.transform(undefined)).toBeNull();
  });

  it('returns null for a blank value', () => {
    expect(pipe.transform('')).toBeNull();
  });

  it('wraps plain text in a paragraph', () => {
    const text = `${newText()} ${newText()}`;

    expect(textsOf(rendered(pipe.transform(text)), 'p')).toEqual([text]);
  });

  it('converts bold Markdown to strong element', () => {
    const word = newText();

    expect(textsOf(rendered(pipe.transform(`**${word}**`)), 'strong')).toEqual([word]);
  });

  it('converts italic Markdown to em element', () => {
    const word = newText();

    expect(textsOf(rendered(pipe.transform(`*${word}*`)), 'em')).toEqual([word]);
  });

  it('converts heading Markdown to heading element', () => {
    const word = newText();

    expect(textsOf(rendered(pipe.transform(`### ${word}`)), 'h3')).toEqual([word]);
  });

  it('converts unordered list Markdown to ul/li elements', () => {
    const items = [newText(), newText()];

    const list = rendered(pipe.transform(items.map(item => `- ${item}`).join('\n'))).firstElementChild;

    expect(list).toBeInstanceOf(HTMLUListElement);
    expect(listItemTexts(list)).toEqual(items);
  });

  it('converts ordered list Markdown to ol/li elements', () => {
    const items = [newText(), newText()];

    const list = rendered(pipe.transform(items.map((item, index) => `${index + 1}. ${item}`).join('\n'))).firstElementChild;

    expect(list).toBeInstanceOf(HTMLOListElement);
    expect(listItemTexts(list)).toEqual(items);
  });

  it('converts inline code to code element', () => {
    const code = `${newText()} ${newText()}`;

    expect(textsOf(rendered(pipe.transform(`${newText()} \`${code}\` ${newText()}`)), 'code')).toEqual([code]);
  });

  it('strips script tags (XSS protection)', () => {
    const payload = newText();
    const result = pipe.transform(`<script>${payload}</script>${newText()}`);

    expect(rendered(result).querySelector('script')).toBeNull();
    expect(result).not.toContain(payload);
  });

  it('strips inline event handlers (XSS protection)', () => {
    const result = pipe.transform(`<p onclick="${newText()}">${newText()}</p>`);

    expect(rendered(result).querySelector('[onclick]')).toBeNull();
  });
});
