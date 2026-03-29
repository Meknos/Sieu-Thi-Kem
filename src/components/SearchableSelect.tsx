'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '-- Chọn --',
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchText('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = options.filter(o =>
    !searchText ||
    o.label.toLowerCase().includes(searchText.toLowerCase()) ||
    (o.sublabel && o.sublabel.toLowerCase().includes(searchText.toLowerCase()))
  );

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
    setSearchText('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setSearchText('');
  }

  return (
    <div ref={containerRef} className={`searchable-select ${className}`} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selected ? 'searchable-select-value' : 'searchable-select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="searchable-select-icons">
          {selected && (
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 cursor-pointer" onClick={handleClear} />
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Gõ tên để tìm..."
              className="searchable-select-input"
            />
          </div>
          <div className="searchable-select-options">
            {filtered.length === 0 ? (
              <div className="searchable-select-empty">Không tìm thấy</div>
            ) : (
              filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`searchable-select-option ${option.value === value ? 'active' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="searchable-select-option-label">{option.label}</span>
                  {option.sublabel && (
                    <span className="searchable-select-option-sublabel">{option.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
