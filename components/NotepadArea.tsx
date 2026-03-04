
import React from 'react';

interface NotepadAreaProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onCopy: () => void;
  onClear: () => void;
  placeholder?: string;
  rows?: number;
}

const NotepadArea: React.FC<NotepadAreaProps> = ({
  label,
  value,
  onChange,
  onCopy,
  onClear,
  placeholder,
  rows = 10
}) => {
  return (
    <div className="flex flex-col w-full mb-6">
      <label className="text-gray-700 font-bold mb-2 ml-1 text-lg">{label}</label>
      <div className="relative border-2 border-yellow-200 rounded-lg shadow-sm bg-yellow-50 overflow-hidden">
        <textarea
          rows={rows}
          className="w-full p-4 bg-transparent outline-none resize-none notepad-font text-xl leading-relaxed text-gray-800"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <div className="absolute left-0 top-0 bottom-0 w-8 border-r border-red-200 opacity-30 pointer-events-none"></div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onCopy}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-sm font-medium"
        >
          Copy
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md transition-colors text-sm font-medium"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default NotepadArea;
