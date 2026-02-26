import { describe, expect, it } from 'vitest';
import { sanitizeCapturePayload } from '../lib/capture-contract';

describe('sanitizeCapturePayload', () => {
  it('keeps only canonical snapshot fields and strips extraction hints', () => {
    const payload = sanitizeCapturePayload({
      html: '<main><h1>Hello</h1></main>',
      url: 'https://example.com/post',
      title: 'Example Post',
      selectionHash: 'abc123',
      isSelection: false,
      tabId: 42,
      metadataHtml: '<meta property="article:published_time" content="2026-02-25T14:43:57+05:30" />',
      captureDiagnostics: {
        strategy: 'deep-body-html',
        initialScrollHeight: 1200,
        finalScrollHeight: 2400,
        scrollStepsExecuted: 3,
        settleWaitMs: 900,
      },
      pipelineMetadata: { stage: 'reddit-shadow' },
      isAlreadyMarkdown: true,
      markdown: '# preprocessed',
    });

    expect(payload).toEqual({
      html: '<main><h1>Hello</h1></main>',
      url: 'https://example.com/post',
      title: 'Example Post',
      selectionHash: 'abc123',
      isSelection: false,
      tabId: 42,
      metadataHtml: '<meta property="article:published_time" content="2026-02-25T14:43:57+05:30" />',
      captureDiagnostics: {
        strategy: 'deep-body-html',
        initialScrollHeight: 1200,
        finalScrollHeight: 2400,
        scrollStepsExecuted: 3,
        settleWaitMs: 900,
      },
    });
    expect((payload as any).pipelineMetadata).toBeUndefined();
    expect((payload as any).isAlreadyMarkdown).toBeUndefined();
    expect((payload as any).markdown).toBeUndefined();
  });

  it('fails closed on malformed capture diagnostics object', () => {
    expect(() =>
      sanitizeCapturePayload({
        html: '<main><h1>Hello</h1></main>',
        url: 'https://example.com/post',
        title: 'Example Post',
        selectionHash: 'abc123',
        captureDiagnostics: {
          strategy: '',
          initialScrollHeight: Number.NaN,
        },
      })
    ).toThrow(/captureDiagnostics/);
  });

  it('fails closed for malformed capture payloads', () => {
    expect(() => sanitizeCapturePayload({})).toThrow(/Invalid capture payload/);
    expect(() =>
      sanitizeCapturePayload({
        html: '',
        url: 'https://example.com',
        title: 'Title',
        selectionHash: 'hash',
      })
    ).toThrow(/html/);
  });
});
