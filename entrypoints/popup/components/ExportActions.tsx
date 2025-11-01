import React, { useState } from 'react';

interface ExportActionsProps {
  onExport: (format: 'md' | 'json', action: 'copy' | 'download') => void;
  disabled?: boolean;
}

export function ExportActions({ onExport, disabled = false }: ExportActionsProps) {
  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Copy Split Button */}
      <div className="relative">
        <div className="flex">
          <button
            onClick={() => onExport('md', 'copy')}
            disabled={disabled}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-lg border transition-colors ${
              disabled
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            📋 Copy
          </button>
          
          <button
            onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
            disabled={disabled}
            className={`px-2 py-2 text-sm border-l-0 border rounded-r-lg transition-colors ${
              disabled
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            ▼
          </button>
        </div>
        
        {copyDropdownOpen && !disabled && (
          <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            <button
              onClick={() => {
                onExport('md', 'copy');
                setCopyDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
            >
              Copy Markdown
            </button>
            <button
              onClick={() => {
                onExport('json', 'copy');
                setCopyDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
            >
              Copy JSON
            </button>
          </div>
        )}
      </div>

      {/* Download Split Button */}
      <div className="relative">
        <div className="flex">
          <button
            onClick={() => onExport('md', 'download')}
            disabled={disabled}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-l-lg border transition-colors ${
              disabled
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            💾 Download
          </button>
          
          <button
            onClick={() => setDownloadDropdownOpen(!downloadDropdownOpen)}
            disabled={disabled}
            className={`px-2 py-2 text-sm border-l-0 border rounded-r-lg transition-colors ${
              disabled
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            ▼
          </button>
        </div>
        
        {downloadDropdownOpen && !disabled && (
          <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            <button
              onClick={() => {
                onExport('md', 'download');
                setDownloadDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
            >
              Download Markdown
            </button>
            <button
              onClick={() => {
                onExport('json', 'download');
                setDownloadDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
            >
              Download JSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


