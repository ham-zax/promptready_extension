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
    });
    expect((payload as any).pipelineMetadata).toBeUndefined();
    expect((payload as any).isAlreadyMarkdown).toBeUndefined();
    expect((payload as any).markdown).toBeUndefined();
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
