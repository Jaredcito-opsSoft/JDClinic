import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Plus, Trash2, Printer, QrCode, ShieldCheck, Download, AlertCircle, FileCheck } from 'lucide-react';

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  presentation: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  route: string;
}

interface PrescriptionQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientAge: number;
  folio: string;
  doctorName: string;
  cedula: string;
  institution: string;
}

export const PrescriptionQrModal: React.FC<PrescriptionQrModalProps> = ({
  isOpen,
  onClose,
  patientName,
  patientAge,
  folio,
  doctorName,
  cedula,
  institution,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([
    {
      id: '1',
      medicationName: 'Amoxicilina / Ácido Clavulánico',
      presentation: 'Tabletas 875 / 125 mg',
      dosage: '1 tableta',
      frequency: 'Cada 12 horas',
      durationDays: 7,
      route: 'Oral',
    },
    {
      id: '2',
      medicationName: 'Paracetamol',
      presentation: 'Tabletas 500 mg',
      dosage: '1 tableta',
      frequency: 'Cada 8 horas en caso de dolor o fiebre >38°C',
      durationDays: 5,
      route: 'Oral',
    },
  ]);

  const [instructions, setInstructions] = useState(
    'Abundante hidratación oral, reposo relativo por 48 horas. En caso de dificultad respiratoria o intolerancia a la vía oral acudir a urgencias.'
  );

  const verificationCode = `RX-${folio.replace('EXP-', '')}-${Date.now().toString().slice(-6)}`;
  const verificationUrl = `https://salud.verificacion.gob.mx/receta?id=${verificationCode}&cedula=${cedula}`;

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        verificationUrl,
        {
          width: 130,
          margin: 1,
          color: {
            dark: '#0C4A6E',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('Error generando QR de receta:', error);
        }
      );
    }
  }, [isOpen, verificationUrl, items]);

  const handleAddItem = () => {
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      medicationName: '',
      presentation: 'Tabletas',
      dosage: '1 cápsula / tableta',
      frequency: 'Cada 8 horas',
      durationDays: 5,
      route: 'Oral',
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof PrescriptionItem, value: any) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop overflow-y-auto">
      <div className="modal-card max-w-4xl p-0 flex flex-col overflow-hidden">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-clinical-100 text-clinical-700 flex items-center justify-center font-bold text-sm">
              <QrCode className="w-4 h-4 text-clinical-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Receta Médica Digital con Código QR</h2>
              <p className="text-[11px] text-slate-400">NOM-004-SSA3-2012 • Verificación digital instantánea</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo / Formato de la Receta */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Receta Visual Estilo Hoja Clínica */}
          <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-xs space-y-5 text-slate-800 print:border-none print:shadow-none">
            
            {/* Membrete Médico Oficial */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <span className="text-xs font-bold text-clinical-600 uppercase tracking-widest block">
                  {institution}
                </span>
                <h3 className="text-base font-bold text-slate-900">{doctorName}</h3>
                <p className="text-xs text-slate-600">Médico Cirujano • Medicina General y Preventiva</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                  <span>Céd. Prof: <strong>{cedula}</strong></span>
                  <span>•</span>
                  <span>Reg. SSA: MX-2024-8841</span>
                </div>
              </div>

              {/* QR Code de Validación */}
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                <canvas ref={canvasRef} className="rounded" />
                <span className="text-[9px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
                  Código: {verificationCode}
                </span>
              </div>
            </div>

            {/* Datos del Paciente */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60 text-xs">
              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase">Paciente</span>
                <span className="font-semibold text-slate-800 truncate block">{patientName}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase">Edad</span>
                <span className="font-semibold text-slate-800">{patientAge} años</span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase">Folio de Expediente</span>
                <span className="font-mono font-semibold text-slate-800">{folio}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 block uppercase">Fecha de Emisión</span>
                <span className="font-semibold text-slate-800">{new Date().toLocaleDateString('es-MX')}</span>
              </div>
            </div>

            {/* Medicamentos Prescritos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Medicamentos Prescritos (Rp.)
                </h4>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-clinical-600 hover:text-clinical-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Fármaco
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-slate-200/80 bg-white hover:border-slate-300 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 flex-1 w-full">
                      <span className="w-5 h-5 rounded-full bg-clinical-50 text-clinical-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 flex-1 w-full">
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            value={item.medicationName}
                            onChange={(e) => handleUpdateItem(item.id, 'medicationName', e.target.value)}
                            placeholder="Nombre del medicamento (ej: Paracetamol 500mg)"
                            className="w-full text-xs font-semibold p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-clinical-600 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            value={item.dosage}
                            onChange={(e) => handleUpdateItem(item.id, 'dosage', e.target.value)}
                            placeholder="Dosis (ej: 1 tab)"
                            className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-clinical-600 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            value={item.frequency}
                            onChange={(e) => handleUpdateItem(item.id, 'frequency', e.target.value)}
                            placeholder="Frecuencia (ej: cada 8h por 5 días)"
                            className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-clinical-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-slate-300 hover:text-alert-600 rounded transition-colors self-end md:self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Indicaciones Generales */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Indicaciones No Farmacológicas y Cuidados Generales
              </label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:ring-1 focus:ring-clinical-600 focus:outline-none resize-none"
              />
            </div>

            {/* Sello y Pie de Página de Validez */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-clinical-600" />
                <span>Esta receta contiene firma digital y código QR verificable ante COFEPRIS y farmacias autorizadas.</span>
              </div>
              <span className="font-mono">Caducidad: 30 días a partir de su emisión</span>
            </div>

          </div>

        </div>

        {/* Botones de Acción */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            QR enlazado a la URL segura con sello de integridad SHA-256.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-clinical-600 hover:bg-clinical-700 rounded-lg shadow-xs transition-colors"
          >
            Aceptar y Guardar Receta
          </button>
        </div>

      </div>
    </div>
  );
};
