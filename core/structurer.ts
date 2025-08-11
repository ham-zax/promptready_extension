// Core structurer module - converts cleaned HTML to structured blocks
// Based on Architecture Section 7 (Core Modules) and PRD Section 14.1

import { PromptReadyExport, ContentBlock, ExportMetadata } from '../lib/types.js';

export interface StructurerOptions {
  mode: 'general' | 'code_docs';
  preserveCodeLanguages: boolean;
  maxHeadingLevel: number;
  includeTableHeaders: boolean;
}

export class ContentStructurer {
  
  /**
   * Convert cleaned HTML to structured PromptReadyExport format
   */
  static async structure(
    cleanedHtml: string,
    metadata: ExportMetadata,
    options: StructurerOptions
  ): Promise<PromptReadyExport> {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanedHtml, 'text/html');
      
      if (!doc.body) {
        throw new Error('Invalid HTML content for structuring');
      }
      
      const blocks = this.extractBlocks(doc.body, options);
      
      return {
        version: '1.0',
        metadata,
        blocks,
      };
      
    } catch (error) {
      console.error('Content structuring failed:', error);
      throw error;
    }
  }
  
  /**
   * Convert structured blocks to Markdown
   */
  static blocksToMarkdown(blocks: ContentBlock[]): string {
    const markdownParts: string[] = [];
    
    for (const block of blocks) {
      const markdown = this.blockToMarkdown(block);
      if (markdown.trim()) {
        markdownParts.push(markdown);
      }
    }
    
    return markdownParts.join('\n\n');
  }
  
  /**
   * Extract structured blocks from DOM
   */
  private static extractBlocks(element: HTMLElement, options: StructurerOptions): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const childNodes = Array.from(element.childNodes);
    
    for (const node of childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elementNode = node as HTMLElement;
        const block = this.processElement(elementNode, options);
        if (block) {
          blocks.push(block);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const textContent = node.textContent?.trim();
        if (textContent) {
          blocks.push({
            type: 'paragraph',
            text: textContent,
          });
        }
      }
    }
    
    return blocks;
  }
  
  /**
   * Process a single HTML element into a content block
   */
  private static processElement(element: HTMLElement, options: StructurerOptions): ContentBlock | null {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return this.processHeading(element, options);
        
      case 'p':
        return this.processParagraph(element);
        
      case 'ul':
      case 'ol':
        return this.processList(element);
        
      case 'table':
        return this.processTable(element, options);
        
      case 'pre':
        return this.processCodeBlock(element, options);
        
      case 'code':
        // Inline code - treat as part of paragraph unless it's a block
        if (element.parentElement?.tagName.toLowerCase() !== 'pre') {
          return this.processParagraph(element);
        }
        return null;
        
      case 'blockquote':
        return this.processQuote(element);
        
      case 'div':
      case 'section':
      case 'article':
        // For container elements, process their children
        const childBlocks = this.extractBlocks(element, options);
        // Flatten the blocks (don't create nested structure)
        return null; // Will be handled by recursive extraction
        
      default:
        // For other elements, treat as paragraph if they have meaningful text
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0) {
          return {
            type: 'paragraph',
            text: textContent,
          };
        }
        return null;
    }
  }
  
  /**
   * Process heading elements
   */
  private static processHeading(element: HTMLElement, options: StructurerOptions): ContentBlock | null {
    const tagName = element.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1), 10);
    
    // Respect maxHeadingLevel option
    const adjustedLevel = Math.min(level, options.maxHeadingLevel);
    
    const text = element.textContent?.trim();
    if (!text) return null;
    
    return {
      type: 'heading',
      level: adjustedLevel,
      text,
    };
  }
  
  /**
   * Process paragraph elements
   */
  private static processParagraph(element: HTMLElement): ContentBlock | null {
    let text = '';
    
    // Handle mixed content (text + inline elements)
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        switch (tagName) {
          case 'strong':
          case 'b':
            text += `**${el.textContent}**`;
            break;
          case 'em':
          case 'i':
            text += `*${el.textContent}*`;
            break;
          case 'code':
            text += `\`${el.textContent}\``;
            break;
          case 'a':
            const href = el.getAttribute('href');
            const linkText = el.textContent;
            if (href && linkText) {
              text += `[${linkText}](${href})`;
            } else {
              text += linkText || '';
            }
            break;
          default:
            text += el.textContent || '';
        }
      }
    }
    
    text = text.trim();
    if (!text) return null;
    
    return {
      type: 'paragraph',
      text,
    };
  }
  
  /**
   * Process list elements (ul/ol)
   */
  private static processList(element: HTMLElement): ContentBlock | null {
    const items: string[] = [];
    const listItems = Array.from(element.querySelectorAll('li'));
    
    for (const li of listItems) {
      const text = li.textContent?.trim();
      if (text) {
        items.push(text);
      }
    }
    
    if (items.length === 0) return null;
    
    return {
      type: 'list',
      items,
    };
  }
  
  /**
   * Process table elements
   */
  private static processTable(element: HTMLElement, options: StructurerOptions): ContentBlock | null {
    const headers: string[] = [];
    const rows: string[][] = [];
    
    // Extract headers
    const headerCells = Array.from(element.querySelectorAll('thead th, tr:first-child th, tr:first-child td'));
    
    if (options.includeTableHeaders && headerCells.length > 0) {
      for (const cell of headerCells) {
        headers.push(cell.textContent?.trim() || '');
      }
    }
    
    // Extract data rows
    const dataRows = Array.from(element.querySelectorAll('tbody tr, tr'));
    
    for (const row of dataRows) {
      // Skip header row if we already processed it
      if (headers.length > 0 && row === dataRows[0] && row.querySelector('th')) {
        continue;
      }
      
      const cells = Array.from(row.querySelectorAll('td, th'));
      const rowData: string[] = [];
      
      for (const cell of cells) {
        rowData.push(cell.textContent?.trim() || '');
      }
      
      if (rowData.some(cell => cell.length > 0)) {
        rows.push(rowData);
      }
    }
    
    if (rows.length === 0) return null;
    
    return {
      type: 'table',
      table: {
        headers: headers.length > 0 ? headers : undefined,
        rows,
      },
    };
  }
  
  /**
   * Process code block elements
   */
  private static processCodeBlock(element: HTMLElement, options: StructurerOptions): ContentBlock | null {
    const codeElement = element.querySelector('code') || element;
    const code = codeElement.textContent || '';
    
    if (!code.trim()) return null;
    
    let language = '';
    
    if (options.preserveCodeLanguages) {
      // Try to detect language from class attributes
      const classAttr = codeElement.className || element.className;
      const languageMatch = classAttr.match(/(?:language-|lang-)([a-zA-Z0-9_+-]+)/);
      if (languageMatch) {
        language = languageMatch[1];
      }
      
      // Try data attributes
      if (!language) {
        language = codeElement.getAttribute('data-language') || 
                   element.getAttribute('data-language') || '';
      }
    }
    
    return {
      type: 'code',
      code: code.trim(),
      language: language || undefined,
    };
  }
  
  /**
   * Process blockquote elements
   */
  private static processQuote(element: HTMLElement): ContentBlock | null {
    const text = element.textContent?.trim();
    if (!text) return null;
    
    return {
      type: 'quote',
      text,
    };
  }
  
  /**
   * Convert a single block to Markdown
   */
  private static blockToMarkdown(block: ContentBlock): string {
    switch (block.type) {
      case 'heading':
        const level = block.level || 1;
        const hashes = '#'.repeat(level);
        return `${hashes} ${block.text}`;
        
      case 'paragraph':
        return block.text || '';
        
      case 'list':
        return (block.items || []).map(item => `- ${item}`).join('\n');
        
      case 'table':
        return this.tableToMarkdown(block.table);
        
      case 'code':
        const language = block.language || '';
        return `\`\`\`${language}\n${block.code}\n\`\`\``;
        
      case 'quote':
        return `> ${block.text}`;
        
      default:
        return '';
    }
  }
  
  /**
   * Convert table structure to Markdown table
   */
  private static tableToMarkdown(table: { headers?: string[]; rows: string[][] } | undefined): string {
    if (!table || !table.rows.length) return '';
    
    const lines: string[] = [];
    
    // Add headers if available
    if (table.headers && table.headers.length > 0) {
      lines.push(`| ${table.headers.join(' | ')} |`);
      lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
    }
    
    // Add data rows
    for (const row of table.rows) {
      lines.push(`| ${row.join(' | ')} |`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Generate citation footer for exports
   */
  static generateCitationFooter(metadata: ExportMetadata): string {
    const capturedDate = new Date(metadata.capturedAt).toLocaleDateString();
    const capturedTime = new Date(metadata.capturedAt).toLocaleTimeString();
    
    return `---

**Source:** ${metadata.url}
**Title:** ${metadata.title}
**Captured:** ${capturedDate} at ${capturedTime}
**Selection Hash:** ${metadata.selectionHash}`;
  }
}
