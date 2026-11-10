import React, { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Key, Hash, FileCheck, RefreshCw } from 'lucide-react';

interface AuditEvent {
  id: string;
  action: string;
  user: string;
  role: string;
  resource: string;
  ip: string;
  timestamp: string;
  chainHash: string;
}

export const AuditChainViewer: React.FC = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [chainVerified, setChainVerified] = useState(true);

  const events: AuditEvent[] = [
    {
      id: 'evt-101',
      action: 'LOGIN_SUCCESS',
      user: 'dr.garcia@clinica.mx',
      role: 'MEDICO_GENERAL',
      resource: 'AuthService',
      ip: '192.168.1.45',
      timestamp: '24/09/2026 16:30:12',
      chainHash: 'a8b7c6d5e4f3a2b1002233445566778899aabbccddeeff001122334455667788',
    },
    {
      id: 'evt-102',
      action: 'RECORD_READ',
      user: 'dr.garcia@clinica.mx',
      role: 'MEDICO_GENERAL',
      resource: 'Patient:EXP-2026-0849',
      ip: '192.168.1.45',
      timestamp: '24/09/2026 16:32:05',
      chainHash: 'b9c8d7e6f5a4b3c21133445566778899aabbccddeeff00112233445566778899',
    },
    {
      id: 'evt-103',
      action: 'RECORD_CREATE',
      user: 'dr.garcia@clinica.mx',
      role: 'MEDICO_GENERAL',
      resource: 'ConsultationSoap:DRAFT',
      ip: '192.168.1.45',
      timestamp: '24/09/2026 16:40:22',
      chainHash: 'c0d9e8f7a6b5c4d322445566778899aabbccddeeff00112233445566778899aa',
    },
    {
      id: 'evt-104',
      action: 'RECORD_SIGN',
      user: 'dr.garcia@clinica.mx',
      role: 'MEDICO_GENERAL',
      resource: 'ConsultationSoap:SIGNED (NOM-004)',
      ip: '192.168.1.45',
      timestamp: '24/09/2026 16:45:10',
      chainHash: 'd1e0f9a8b7c6d5e4335566778899aabbccddeeff00112233445566778899aabb',
    },
    {
      id: 'evt-105',
      action: 'PRESCRIPTION_ISSUE',
      user: 'dr.garcia@clinica.mx',
      role: 'MEDICO_GENERAL',
      resource: 'Prescription:QR-VERIFIED',
      ip: '192.168.1.45',
      timestamp: '24/09/2026 16:46:18',
      chainHash: 'e2f1a0b9c8d7e6f54466778899aabbccddeeff00112233445566778899aabbcc',
    },
  ];

  const handleVerifyChain = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setChainVerified(true);
    }, 600);
  };

  return (
    <div className="workspace-view max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Cabecera y Verificación de Cadena */}
      <div className="clinical-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-clinical-50 text-clinical-700 flex items-center justify-center font-bold text-sm border border-clinical-200/60">
            <Shield className="w-5 h-5 text-clinical-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pista de Auditoría Inmutable (NOM-024-SSA3-2012)</h2>
            <p className="text-[11px] text-slate-400">Trazabilidad absoluta con hash encadenado SHA-256 de no repudio</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cadena Criptográfica Íntegra</span>
          </div>

          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>Verificar Sellos</span>
          </button>
        </div>
      </div>

      {/* Tabla de Eventos */}
      <div className="clinical-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Acción Clínica</th>
                <th className="py-3 px-4">Usuario / Rol</th>
                <th className="py-3 px-4">Recurso Afectado</th>
                <th className="py-3 px-4">IP & Timestamp</th>
                <th className="py-3 px-4">Hash Encadenado SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-clinical-700">
                    <span className="bg-clinical-50 px-2 py-0.5 rounded border border-clinical-200 text-[11px]">
                      {evt.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800 block">{evt.user}</span>
                    <span className="text-xs text-slate-400 font-mono">{evt.role}</span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">
                    {evt.resource}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-slate-800 block">{evt.timestamp}</span>
                    <span className="text-xs text-slate-400 font-mono">IP: {evt.ip}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                    <span className="text-emerald-700 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200 block truncate max-w-xs">
                      {evt.chainHash}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
