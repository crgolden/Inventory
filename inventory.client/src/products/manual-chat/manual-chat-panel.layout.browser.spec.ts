import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { newCount, newDisplayName, newHttpsAddress, newId, randomIntBetween } from '@crgolden/modules/testing';
import { ChatService } from './chat.service';
import { ManualChatPanelComponent } from './manual-chat-panel.component';
import layoutSettings from './manual-chat-layout-settings.json';

const SUB_PIXEL_ROUNDING_TOLERANCE_PX = 1;
const MARKDOWN_PARAGRAPH_BREAK = '\n\n';

interface Viewport {
  readonly width: number;
  readonly height: number;
}

interface PanelBox {
  readonly top: number;
  readonly left: number;
  readonly rightGap: number;
  readonly width: number;
  readonly viewportWidth: number;
}

interface PanelMetrics {
  readonly panelClientHeight: number;
  readonly panelBottom: number;
  readonly listClientHeight: number;
  readonly listScrollHeight: number;
  readonly viewportHeight: number;
}

function stubbedChatService(reply: string): Pick<ChatService, 'createChat' | 'updateChatTitle' | 'streamMessage'> {
  return {
    createChat: () => of({ chatId: newId(), title: null, createdAt: newCount() }),
    updateChatTitle: () => of(undefined),
    streamMessage: () => of(reply),
  };
}

function longReplyNaming(manualUrl: string): string {
  const paragraphs = Array.from({ length: randomIntBetween(8, 12) }, () => newDisplayName());
  return [`${newDisplayName()} ${manualUrl}`, ...paragraphs].join(MARKDOWN_PARAGRAPH_BREAK);
}

async function openThePanelAt(viewport: Viewport, reply: string): Promise<ComponentFixture<ManualChatPanelComponent>> {
  await page.viewport(viewport.width, viewport.height);
  await TestBed.configureTestingModule({
    imports: [ManualChatPanelComponent],
    providers: [{ provide: ChatService, useValue: stubbedChatService(reply) }],
  }).compileComponents();
  const fixture = TestBed.createComponent(ManualChatPanelComponent);
  fixture.componentInstance.open();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function requiredElementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`#${id} is not in the DOM, so it cannot be measured.`);
  }
  return element;
}

function measurePanelBox(): PanelBox {
  const box = requiredElementById('manual-chat-panel').getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  return { top: box.top, left: box.left, rightGap: viewportWidth - box.right, width: box.width, viewportWidth };
}

function measurePanel(): PanelMetrics {
  const panel = requiredElementById('manual-chat-panel');
  const list = requiredElementById('manual-chat-messages');
  return {
    panelClientHeight: panel.clientHeight,
    panelBottom: panel.getBoundingClientRect().bottom,
    listClientHeight: list.clientHeight,
    listScrollHeight: list.scrollHeight,
    viewportHeight: window.innerHeight,
  };
}

function sendMessages(fixture: ComponentFixture<ManualChatPanelComponent>, count: number): void {
  for (let sent = 0; sent < count; sent++) {
    const input = requiredElementById('manual-chat-input') as HTMLTextAreaElement;
    input.value = newDisplayName();
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    requiredElementById('manual-chat-send').click();
    fixture.detectChanges();
  }
}

describe('ManualChatPanelComponent layout in a real browser', () => {
  it('on a phone the open panel covers the whole screen, navbar included', async () => {
    await openThePanelAt(layoutSettings.phoneViewport, longReplyNaming(newHttpsAddress()));

    const panel = measurePanelBox();

    expect(panel.top, 'below the md breakpoint the panel starts at the top of the screen').toBeLessThanOrEqual(
      SUB_PIXEL_ROUNDING_TOLERANCE_PX,
    );
    expect(panel.left).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
    expect(Math.abs(panel.width - panel.viewportWidth)).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  it('on a wide screen the open panel is a right-hand drawer below the navbar', async () => {
    await openThePanelAt(layoutSettings.wideViewport, longReplyNaming(newHttpsAddress()));

    const panel = measurePanelBox();

    expect(panel.top, 'at md and wider the drawer sits below the fixed navbar').toBeGreaterThan(
      SUB_PIXEL_ROUNDING_TOLERANCE_PX,
    );
    expect(panel.rightGap).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
    expect(panel.left, 'a drawer leaves the page visible to its left').toBeGreaterThan(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  it('the message list scrolls inside the panel rather than spilling past it', async () => {
    const messagesOverflowingThePanel = randomIntBetween(6, 10);
    const fixture = await openThePanelAt(layoutSettings.wideViewport, longReplyNaming(newHttpsAddress()));

    sendMessages(fixture, messagesOverflowingThePanel);

    const { panelClientHeight, panelBottom, listClientHeight, listScrollHeight, viewportHeight } = measurePanel();

    expect(
      listClientHeight,
      `the message list (${listClientHeight}px) must fit within the panel (${panelClientHeight}px)`,
    ).toBeLessThanOrEqual(panelClientHeight);
    expect(
      listScrollHeight,
      `after ${messagesOverflowingThePanel} messages the list must overflow and scroll; a list that did not ` +
        'overflow cannot tell a contained layout from a broken one',
    ).toBeGreaterThan(listClientHeight);
    expect(panelBottom, `the panel bottom (${panelBottom}) must not pass the viewport (${viewportHeight})`).toBeLessThanOrEqual(
      viewportHeight + SUB_PIXEL_ROUNDING_TOLERANCE_PX,
    );
  });
});
