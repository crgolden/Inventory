import { constants } from 'node:http2';
import { test, expect, type Page } from '@playwright/test';
import { newDisplayName, newHttpsAddress, newId, randomIntBetween } from '@crgolden/modules/testing';
import e2eSettings from './e2e-settings.json';
import { MarkdownConstants } from './markdown-constants';
import { SseConstants } from './mocks/sse-constants';
import { NEW_PRODUCT_URL } from '../src/app/app-paths';
import { CHATS_URL, JSON_CONTENT_TYPE, SseFraming } from '../src/products/manual-chat/chat-api';

const MESSAGES_OVERFLOWING_THE_PANEL = randomIntBetween(6, 10);
const SUB_PIXEL_ROUNDING_TOLERANCE_PX = 1;
const STUBBED_MANUAL_URL = newHttpsAddress();
const STUBBED_CHAT_ID = newId();
const REPLY_PARAGRAPHS = randomIntBetween(8, 12);
const MANUAL_LEAD_IN = newDisplayName();
const REPLY_BODY_PARAGRAPHS = Array.from({ length: REPLY_PARAGRAPHS }, () => newDisplayName());

const stubbedReply = [`${MANUAL_LEAD_IN} ${STUBBED_MANUAL_URL}`, ...REPLY_BODY_PARAGRAPHS].join(
  MarkdownConstants.paragraphBreak,
);

function sseEvent(data: string): string {
  return `${SseFraming.dataPrefix}${data}${SseConstants.eventTerminator}`;
}

function sseBody(content: string): string {
  return `${sseEvent(JSON.stringify({ delta: { content } }))}${sseEvent(SseFraming.done)}`;
}

async function stubTheManualsChat(page: Page): Promise<void> {
  await page.route(`**${CHATS_URL}`, route =>
    route.fulfill({
      status: constants.HTTP_STATUS_OK,
      contentType: JSON_CONTENT_TYPE,
      body: JSON.stringify({ chatId: STUBBED_CHAT_ID, title: null, createdAt: 0 }),
    }),
  );
  await page.route(`**${CHATS_URL}/*`, route => route.fulfill({ status: constants.HTTP_STATUS_NO_CONTENT, body: '' }));
  await page.route(`**${CHATS_URL}/*/messages/stream`, route =>
    route.fulfill({
      status: constants.HTTP_STATUS_OK,
      contentType: SseConstants.contentType,
      body: sseBody(stubbedReply),
    }),
  );
}

interface PanelMetrics {
  readonly panelClientHeight: number;
  readonly panelBottom: number;
  readonly listClientHeight: number;
  readonly listScrollHeight: number;
  readonly viewportHeight: number;
}

async function measurePanel(page: Page): Promise<PanelMetrics> {
  return page.evaluate(() => {
    const panel = document.getElementById('manual-chat-panel');
    const list = document.getElementById('manual-chat-messages');
    if (panel === null || list === null) {
      throw new Error('the chat panel or its message list left the DOM before it could be measured');
    }
    return {
      panelClientHeight: panel.clientHeight,
      panelBottom: panel.getBoundingClientRect().bottom,
      listClientHeight: list.clientHeight,
      listScrollHeight: list.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
}

interface PanelBox {
  readonly top: number;
  readonly left: number;
  readonly rightGap: number;
  readonly width: number;
  readonly viewportWidth: number;
}

async function openThePanelAt(page: Page, viewport: { width: number; height: number }): Promise<PanelBox> {
  await stubTheManualsChat(page);
  await page.setViewportSize(viewport);
  await page.goto(NEW_PRODUCT_URL);
  await page.locator('#manual-chat-toggle').click();
  await expect(page.locator('#manual-chat-panel')).toBeVisible();
  return page.evaluate(() => {
    const panel = document.getElementById('manual-chat-panel');
    if (panel === null) {
      throw new Error('the chat panel left the DOM before it could be measured');
    }
    const box = panel.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    return { top: box.top, left: box.left, rightGap: viewportWidth - box.right, width: box.width, viewportWidth };
  });
}

test.describe('Manual chat panel geometry', () => {
  test('on a phone the open panel is a full-screen overlay that covers the navbar', async ({ page }) => {
    const panel = await openThePanelAt(page, e2eSettings.phoneViewport);

    expect(panel.top, 'below the md breakpoint the panel starts at the top of the screen, not under the navbar').toBeLessThanOrEqual(
      SUB_PIXEL_ROUNDING_TOLERANCE_PX,
    );
    expect(panel.left).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
    expect(Math.abs(panel.width - panel.viewportWidth)).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });

  test('on a wide screen the open panel is a right-hand drawer under the navbar', async ({ page }) => {
    const panel = await openThePanelAt(page, e2eSettings.wideViewport);

    expect(panel.top, 'at md and wider the drawer sits below the fixed navbar').toBeGreaterThan(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
    expect(panel.rightGap).toBeLessThanOrEqual(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
    expect(panel.left, 'a drawer leaves the page visible to its left').toBeGreaterThan(SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });
});

test.describe('Manual chat panel layout', () => {
  test('the message list scrolls inside the panel rather than spilling past it', async ({ page }) => {
    await stubTheManualsChat(page);
    await page.goto(NEW_PRODUCT_URL);
    await page.locator('#manual-chat-toggle').click();
    await expect(page.locator('#manual-chat-panel')).toBeVisible();

    for (let sent = 0; sent < MESSAGES_OVERFLOWING_THE_PANEL; sent++) {
      const question = newDisplayName();
      await page.locator('#manual-chat-input').fill(question);
      await page.locator('#manual-chat-send').click();
      const chip = page.locator(`#url-chip-${sent * 2 + 1}-0`);
      await expect(chip).toBeVisible();
      await expect(chip).toHaveAttribute('title', STUBBED_MANUAL_URL);
    }

    const { panelClientHeight, panelBottom, listClientHeight, listScrollHeight, viewportHeight } =
      await measurePanel(page);

    expect(
      listClientHeight,
      `the message list (${listClientHeight}px) must fit within the panel (${panelClientHeight}px), or its ` +
        'content spills past the panel’s bottom edge',
    ).toBeLessThanOrEqual(panelClientHeight);
    expect(
      listScrollHeight,
      `the message list must be scrollable after ${MESSAGES_OVERFLOWING_THE_PANEL} messages: scrollHeight ` +
        `(${listScrollHeight}) should exceed clientHeight (${listClientHeight}). A list that did not overflow ` +
        'cannot tell a contained layout from a broken one.',
    ).toBeGreaterThan(listClientHeight);
    expect(
      panelBottom,
      `the panel bottom (${panelBottom}) must not exceed the viewport height (${viewportHeight})`,
    ).toBeLessThanOrEqual(viewportHeight + SUB_PIXEL_ROUNDING_TOLERANCE_PX);
  });
});
