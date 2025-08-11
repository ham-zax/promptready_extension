// File naming utilities for PromptReady exports
// Implements PRD Section 6 naming convention: <title>__YYYY-MM-DD__hhmm__hash.(md|json)

import { FileNaming } from './types.js';

export class FileNamingService implements FileNaming {
  
  /**
   * Generate a standardized filename following the PRD convention
   * Format: <title>__YYYY-MM-DD__hhmm__hash.(md|json)
   */
  generateFileName(title: string, format: 'md' | 'json', hash: string): string {
    const sanitizedTitle = this.sanitizeTitle(title);
    const timestamp = this.formatTimestamp(new Date());
    const shortHash = hash.substring(0, 8); // First 8 chars of hash
    
    return `${sanitizedTitle}__${timestamp}__${shortHash}.${format}`;
  }
  
  /**
   * Sanitize title for safe filename use
   * Remove/replace unsafe characters and limit length
   */
  sanitizeTitle(title: string): string {
    return title
      // Remove or replace unsafe filename characters
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      // Replace spaces and other whitespace with hyphens
      .replace(/\s+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length to reasonable filename size
      .substring(0, 50)
      // Ensure we don't end with a period (Windows issue)
      .replace(/\.+$/, '')
      // Default fallback if title becomes empty
      || 'untitled';
  }
  
  /**
   * Format timestamp for filename
   * Format: YYYY-MM-DD__hhmm
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}__${hours}${minutes}`;
  }
  
  /**
   * Generate a simple selection hash for citation integrity
   * Uses SHA-256 of normalized content
   */
  static async generateSelectionHash(content: string): Promise<string> {
    try {
      // Normalize content by removing extra whitespace
      const normalized = content.trim().replace(/\s+/g, ' ');
      
      // Generate SHA-256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
    } catch (error) {
      console.error('Failed to generate selection hash:', error);
      // Fallback to timestamp-based hash
      return Date.now().toString(36);
    }
  }
  
  /**
   * Validate filename safety across platforms
   */
  static isValidFileName(filename: string): boolean {
    // Check for empty or only whitespace
    if (!filename.trim()) return false;
    
    // Check for reserved names (Windows)
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    const nameWithoutExt = filename.replace(/\.[^.]*$/, '').toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) return false;
    
    // Check for unsafe characters
    const unsafeChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (unsafeChars.test(filename)) return false;
    
    // Check length (most filesystems support 255 chars)
    if (filename.length > 255) return false;
    
    return true;
  }
}

// Export singleton instance
export const fileNaming = new FileNamingService();
