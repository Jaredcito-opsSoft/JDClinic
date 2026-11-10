import React, { useState } from 'react';
import { Search, Check, Hash } from 'lucide-react';

export interface Icd10Item {
  code: string;
  description: string;
  category: string;
}

const COMMON_ICD10: Icd10Item[] = [
  { code: 'J00', description: 'Rinofaringitis aguda [resfriado común]', category: 'Respiratorio' },
  { code: 'J02.9', description: 'Faringitis aguda, no especificada', category: 'Respiratorio' },
  { code: 'J03.9', description: 'Amigdalitis aguda, no especificada', category: 'Respiratorio' },
  { code: 'J20.9', description: 'Bronquitis aguda, no especificada', category: 'Respiratorio' },
  { code: 'I10', description: 'Hipertensión esencial (primaria)', category: 'Cardiovascular' },
  { code: 'E11.9', description: 'Diabetes mellitus tipo 2 sin mención de complicación', category: 'Endocrino' },
  { code: 'K29.7', description: 'Gastritis, no especificada', category: 'Digestivo' },
  { code: 'K21.9', description: 'Enfermedad por reflujo gastroesofágico sin esofagitis', category: 'Digestivo' },
  { code: 'M54.5', description: 'Lumbago no especificado', category: 'Musculoesquelético' },
  { code: 'N39.0', description: 'Infección de vías urinarias, sitio no especificado', category: 'Genitourinario' },
  { code: 'B34.9', description: 'Infección viral, no especificada', category: 'Infeccioso' },
  { code: 'R10.4', description: 'Otros dolores abdominales y los no especificados', category: 'Síntomas' },
];

interface Icd10PickerProps {
  selectedCode: string;
  onSelect: (item: Icd10Item) => void;
  disabled?: boolean;
}

export const Icd10Picker: React.FC<Icd10PickerProps> = ({ selectedCode, onSelect, disabled = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = COMMON_ICD10.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSelection = COMMON_ICD10.find((item) => item.code === selectedCode);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between text-left text-xs p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-clinical-600 disabled:opacity-60 transition-all"
        >
          {currentSelection ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-clinical-700 bg-clinical-50 px-2 py-0.5 rounded border border-clinical-200">
                {currentSelection.code}
              </span>
              <span className="text-slate-700 truncate">{currentSelection.description}</span>
            </div>
          ) : (
            <span className="text-slate-400">Seleccionar código CIE-10...</span>
          )}
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="glass-popover absolute left-0 right-0 top-full mt-1.5 z-40 p-2.5 max-h-64 overflow-y-auto">
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar por código o descripción (ej: J00, hipertensión)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-clinical-600"
            />
          </div>

          <div className="space-y-1">
            {filtered.map((item) => {
              const isSelected = item.code === selectedCode;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected ? 'bg-clinical-50 text-clinical-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-clinical-700 w-12 shrink-0">{item.code}</span>
                    <span className="truncate">{item.description}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-clinical-600 shrink-0 ml-2" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-3">No se encontraron diagnósticos CIE-10</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
