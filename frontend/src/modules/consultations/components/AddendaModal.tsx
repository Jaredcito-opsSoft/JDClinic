import React, { useState } from 'react';
import { X, FilePlus2, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

interface AddendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string;
  onSaveAddenda: (text: string) => Promise<void> | void;
}

export const AddendaModal: React.FC<AddendaModalProps> = ({
  isOpen,
  onClose,
  consultationId: _consultationId,
  onSaveAddenda,
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 10) return;

    setError('');
    setIsSubmitting(true);
    try {
      await onSaveAddenda(content.trim());
      setContent('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible anexar la adenda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    setContent('');
    onClose();
  };

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card max-w-lg p-0">
        <div className="px-6 py-4 border-b border-clinic-line flex items-center justify-between bg-white/35">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
              <FilePlus2 className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-clinic-ink">Registrar Adenda Aclaratoria</h2>
              <p className="text-[11px] text-clinic-muted">NOM-004-SSA3-2012 · Ajuste cronológico inmutable</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="icon-action"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              La nota médica original permanece <strong>inalterada</strong>. Esta adenda se anexará en la trazabilidad con fecha, hora exacta y firma digital del médico.
            </p>
          </div>

          {error && <div className="status-error">{error}</div>}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="field-label uppercase tracking-wider">
                Contenido de la nota aclaratoria
              </label>
              <span className={`text-xs ${content.length < 10 ? 'text-amber-600' : 'text-clinic-muted'}`}>
                {content.length}/10 caracteres mín.
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Especifique el motivo de la aclaración, hallazgos subsecuentes o estudios recibidos..."
              className="field-control min-h-28 resize-y"
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="secondary-action"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || content.trim().length < 10}
              className="primary-action"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Firmando adenda…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Firmar y anexar adenda</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
